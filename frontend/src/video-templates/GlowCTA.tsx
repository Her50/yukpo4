import { motion } from 'framer-motion';
import React from 'react';
import './styles.css';
import { GlowCTAProps, defaultTheme } from './types';

const GlowCTA: React.FC<GlowCTAProps> = ({
    title,
    buttonLabel,
    url,
    theme = defaultTheme,
}) => {
    return (
        <div
            className="yt-cta-container"
            style={{
                background: `linear-gradient(160deg, ${theme.primary} 0%, ${theme.background} 80%)`,
                color: theme.text,
            }}
        >
            <motion.div
                className="yt-cta-orb"
                animate={{ scale: [1.1, 1.35, 1.1], opacity: [0.25, 0.4, 0.25] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
                style={{ background: theme.accent }}
            />

            <motion.h2
                className="yt-cta-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                {title}
            </motion.h2>

            <motion.a
                className="yt-cta-button"
                href={url || '#'}
                target="_blank"
                rel="noreferrer"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [1, 1.04, 1], opacity: 1 }}
                transition={{ duration: 0.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                style={{ background: theme.secondary }}
                onClick={(event) => {
                    if (!url) {
                        event.preventDefault();
                    }
                }}
            >
                {buttonLabel}
            </motion.a>
        </div>
    );
};

export default GlowCTA;


