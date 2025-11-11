import { motion } from 'framer-motion';
import React from 'react';
import './styles.css';
import { ProductShowcaseProps, defaultTheme } from './types';

const ProductShowcase: React.FC<ProductShowcaseProps> = ({
    products,
    theme = defaultTheme,
    showPrice = true,
    highlightPromotion = true,
}) => {
    const visibleProducts = products.slice(0, 3);

    return (
        <div
            className="yt-product-container"
            style={{
                background: `linear-gradient(135deg, ${theme.background} 0%, #020617 100%)`,
                color: theme.text,
            }}
        >
            <div className="yt-product-grid">
                {visibleProducts.map((product, index) => (
                    <motion.div
                        key={product.id}
                        className="yt-product-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.15, duration: 0.6 }}
                    >
                        {product.imageUrl ? (
                            <div className="yt-product-image">
                                <img src={product.imageUrl} alt={product.title} loading="lazy" />
                                <motion.div
                                    className="yt-product-kenburns"
                                    animate={{ scale: [1, 1.08, 1] }}
                                    transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
                                />
                            </div>
                        ) : (
                            <div className="yt-product-placeholder" style={{ backgroundColor: theme.primary }}>
                                <span>{product.title.slice(0, 1)}</span>
                            </div>
                        )}

                        <div className="yt-product-content">
                            <h3>{product.title}</h3>
                            {product.description ? <p>{product.description}</p> : null}
                        </div>

                        <div className="yt-product-footer">
                            {showPrice && product.price ? (
                                <span className="yt-product-price" style={{ color: theme.secondary }}>
                                    {product.price}
                                </span>
                            ) : null}
                            {highlightPromotion && product.promotion ? (
                                <span className="yt-product-promo" style={{ backgroundColor: theme.accent }}>
                                    {product.promotion}
                                </span>
                            ) : null}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default ProductShowcase;


