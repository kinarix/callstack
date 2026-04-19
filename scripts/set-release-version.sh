#!/bin/bash

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CARGO_FILE="$REPO_ROOT/src-tauri/Cargo.toml"
CONF_FILE="$REPO_ROOT/src-tauri/tauri.conf.json"

# ── Detect docs-only changes ────────────────────────────────────
# Check both staged+unstaged changes and unpushed commits.
# If every changed file lives under docs/, skip the version bump.
cd "$REPO_ROOT"

ALL_CHANGED=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
NON_DOCS=$(echo "$ALL_CHANGED" | grep -v '^docs/' | grep -v '^$' || true)

if [ -z "$NON_DOCS" ] && [ -n "$ALL_CHANGED" ]; then
    CURRENT_VERSION=$(grep -m1 'version = ' "$CARGO_FILE" | sed 's/.*version = "\([^"]*\)".*/\1/')
    echo -e "${YELLOW}Only docs/ files changed — skipping version bump (staying at v$CURRENT_VERSION).${NC}"
    echo ""

    read -p "$(echo -e ${BLUE})Commit message$(echo -e ${NC}): " COMMIT_MSG
    COMMIT_MSG="${COMMIT_MSG:-Update website}"

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git add docs/
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓${NC} Committed: $COMMIT_MSG"

    git push origin "$CURRENT_BRANCH"
    echo -e "${GREEN}✓${NC} Pushed to origin/$CURRENT_BRANCH (no release triggered)"
    exit 0
fi

# ── Normal release flow ─────────────────────────────────────────

# Get current version
CURRENT_VERSION=$(grep -m1 'version = ' "$CARGO_FILE" | sed 's/.*version = "\([^"]*\)".*/\1/')

echo -e "${BLUE}Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo ""

# Prompt for new version
read -p "$(echo -e ${BLUE})Enter new version (format: X.Y.Z)$(echo -e ${NC}): " NEW_VERSION

# Validate version format (basic semver)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Invalid version format. Use X.Y.Z (e.g., 0.4.0)${NC}"
    exit 1
fi

if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
    echo -e "${YELLOW}Version unchanged.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Updating files...${NC}"

# Update Cargo.toml
sed -i '' "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" "$CARGO_FILE"
echo -e "${GREEN}✓${NC} Updated $CARGO_FILE"

# Update tauri.conf.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$CONF_FILE"
echo -e "${GREEN}✓${NC} Updated $CONF_FILE"

echo ""
echo -e "${GREEN}Version updated: ${YELLOW}$CURRENT_VERSION${NC} → ${YELLOW}$NEW_VERSION${NC}"
echo ""

# Update Cargo.lock
echo -e "${BLUE}Updating Cargo.lock...${NC}"
cd "$REPO_ROOT/src-tauri"
cargo update
echo -e "${GREEN}✓${NC} Updated Cargo.lock"
echo ""

# Collect unpushed commit messages
cd "$REPO_ROOT"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
UNPUSHED=$(git log origin/"$CURRENT_BRANCH"..HEAD --pretty=format:"- %s" 2>/dev/null || true)

# Build default commit message from unpushed commits
if [ -n "$UNPUSHED" ]; then
    echo -e "${BLUE}Unpushed commits:${NC}"
    echo "$UNPUSHED"
    echo ""
    DEFAULT_MSG=$(git log origin/"$CURRENT_BRANCH"..HEAD --pretty=format:"%s" 2>/dev/null | paste -sd '|' - | sed 's/|/. /g')
else
    DEFAULT_MSG=""
fi

read -p "$(echo -e ${BLUE})Commit message [${DEFAULT_MSG}]$(echo -e ${NC}): " COMMIT_MSG
COMMIT_MSG="${COMMIT_MSG:-$DEFAULT_MSG}"
FULL_MSG="$COMMIT_MSG (v$NEW_VERSION)"

# Stage all changes and commit
git add -A
git commit -m "$FULL_MSG"
echo -e "${GREEN}✓${NC} Committed: $FULL_MSG"

# Push to current branch
git push origin "$CURRENT_BRANCH"
echo -e "${GREEN}✓${NC} Pushed to origin/$CURRENT_BRANCH"
