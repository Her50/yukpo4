import { motion } from 'framer-motion';
import React from 'react';
import './styles.css';
import { IntroPulseProps, defaultTheme } from './types';

const IntroPulse: React.FC<IntroPulseProps> = ({
    headline,
    subheadline,
    theme = defaultTheme,
    backgroundMediaUrl,
}) => {
    return (
        <div
            className="yt-intro-container"
            style={{
                background: `radial-gradient(circle at top, ${theme.primary} 0%, ${theme.background} 45%, ${theme.background} 100%)`,
                color: theme.text,
            }}
        >
            {backgroundMediaUrl ? (
                <motion.div
                    className="yt-intro-bg"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 0.35, scale: 1 }}
                    transition={{ duration: 1.2 }}
                    style={{ backgroundImage: `url(${backgroundMediaUrl})` }}
                />
            ) : null}

            <motion.div
                className="yt-intro-glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)` }}
            />

            <motion.div
                className="yt-intro-headline"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
            >
                <span className="yt-intro-badge" style={{ backgroundColor: theme.accent }}>
                    Nouveau sur Yukpo
                </span>
                <h1>{headline}</h1>
                {subheadline ? (
                    <motion.p
                        className="yt-intro-subheadline"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 0.85, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                    >
                        {subheadline}
                    </motion.p>
                ) : null}
            </motion.div>
        </div>
    );
};

export default IntroPulse;


