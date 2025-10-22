/**
 * Dialog Component - Version simplifiée sans @radix-ui
 */
import * as React from "react"

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

interface DialogContentProps {
    className?: string;
    children: React.ReactNode;
}

interface DialogHeaderProps {
    children: React.ReactNode;
}

interface DialogFooterProps {
    children: React.ReactNode;
}

interface DialogTitleProps {
    children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => onOpenChange?.(false)}
        >
            {/* Overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-50" />
            
            {/* Content */}
            <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};

const DialogContent: React.FC<DialogContentProps> = ({ className = "", children }) => {
    return (
        <div className={`bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 ${className}`}>
            {children}
        </div>
    );
};

const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
    return (
        <div className="mb-4">
            {children}
        </div>
    );
};

const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => {
    return (
        <h2 className="text-xl font-bold text-gray-900">
            {children}
        </h2>
    );
};

const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
    return (
        <div className="mt-6 flex justify-end gap-3">
            {children}
        </div>
    );
};

const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <p className="text-sm text-gray-600 mt-2">
            {children}
        </p>
    );
};

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription };
