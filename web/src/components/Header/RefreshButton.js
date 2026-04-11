import { jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './RefreshButton.module.css';
export function RefreshButton() {
    const [isUpdating, setIsUpdating] = useState(false);
    const handleRefresh = async () => {
        setIsUpdating(true);
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.update();
                }
            }
            else {
                window.location.reload();
            }
        }
        finally {
            setIsUpdating(false);
        }
    };
    return (_jsxs("button", { className: `${styles.button} ${isUpdating ? styles.updating : ''}`, onClick: handleRefresh, disabled: isUpdating, title: "Check for updates", children: ["\u21BB ", isUpdating ? 'Checking...' : 'Refresh'] }));
}
