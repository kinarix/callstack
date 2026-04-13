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

# Stage and commit
cd "$REPO_ROOT"
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "Release version $NEW_VERSION"
echo -e "${GREEN}✓${NC} Committed"

# Push
git push origin release
echo -e "${GREEN}✓${NC} Pushed to origin/release"
