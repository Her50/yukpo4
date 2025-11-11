import { motion } from 'framer-motion';
import React from 'react';
import './styles.css';
import { ARHighlightProps, defaultTheme } from './types';

const ARHighlight: React.FC<ARHighlightProps> = ({
    title,
    bulletPoints,
    icon = '✨',
    theme = defaultTheme,
}) => {
    return (
        <div
            className="yt-ar-container"
            style={{
                background: `radial-gradient(circle at center, rgba(99, 102, 241, 0.35), ${theme.background})`,
                color: theme.text,
            }}
        >
            <motion.div
                className="yt-ar-chip"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                style={{ borderColor: theme.primary }}
            >
                <span>{icon}</span>
            </motion.div>

            <motion.h2
                className="yt-ar-title"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                {title}
            </motion.h2>

            <ul className="yt-ar-points">
                {bulletPoints.slice(0, 3).map((point, index) => (
                    <motion.li
                        key={`point-${index}`}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 * index, duration: 0.5 }}
                    >
                        <span className="yt-ar-bullet" style={{ background: theme.accent }} />
                        <span>{point}</span>
                    </motion.li>
                ))}
            </ul>
        </div>
    );
};

export default ARHighlight;


