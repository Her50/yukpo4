import {
    ARHighlight,
    GlowCTA,
    IntroPulse,
    ProductShowcase,
    TemplateProduct,
} from '@/video-templates';
import type { Meta, StoryObj } from '@storybook/react';

const sampleProducts: TemplateProduct[] = [
    {
        id: '1',
        title: 'Coiffure Prestige',
        price: '5 000 XAF',
        promotion: '-15%',
        imageUrl:
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
        description: 'Transformation express avec soins premium.',
    },
    {
        id: '2',
        title: 'Gadget connectée',
        price: '18 000 XAF',
        promotion: 'Livraison offerte',
        imageUrl:
            'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80',
        description: 'Boostez votre productivité dès aujourd’hui.',
    },
    {
        id: '3',
        title: 'Menu Senior Chef',
        price: '7 500 XAF',
        promotion: 'Menu du jour',
        imageUrl:
            'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
        description: 'Saveurs africaines revisitées.',
    },
];

const meta = {
    title: 'Video/Templates immersifs',
    parameters: {
        layout: 'fullscreen',
    },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Intro: Story = {
    render: () => (
        <div style={{ width: 360, height: 640 }}>
            <IntroPulse
                headline="La vitrine immersive Yukpo"
                subheadline="Générez en 30 secondes une vidéo pro synchronisée sur vos produits."
                backgroundMediaUrl="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80"
            />
        </div>
    ),
};

export const Products: Story = {
    render: () => (
        <div style={{ width: 360, height: 640 }}>
            <ProductShowcase products={sampleProducts} />
        </div>
    ),
};

export const Highlight: Story = {
    render: () => (
        <div style={{ width: 360, height: 640 }}>
            <ARHighlight
                title="Livraison express en 2h"
                bulletPoints={[
                    'Suivi en temps réel',
                    'Zones Douala & Yaoundé',
                    'Paiement sécurisé à la livraison',
                ]}
            />
        </div>
    ),
};

export const CTA: Story = {
    render: () => (
        <div style={{ width: 360, height: 640 }}>
            <GlowCTA title="Prêt à booster vos ventes ?" buttonLabel="Lancer mon clip immersif" />
        </div>
    ),
};


