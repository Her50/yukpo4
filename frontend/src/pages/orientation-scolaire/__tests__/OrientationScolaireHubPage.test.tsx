// ✅ Tests pour OrientationScolaireHubPage

import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import OrientationScolaireHubPage from '../OrientationScolaireHubPage';

// Mock du contexte d'authentification
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
    }),
}));

// Mock du service API
jest.mock('../../../services/apiService', () => ({
    apiGet: jest.fn(),
}));

const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('OrientationScolaireHubPage', () => {
    it('should render the hub page with title', () => {
        renderWithRouter(<OrientationScolaireHubPage />);
        expect(screen.getByText('Orientation Scolaire')).toBeInTheDocument();
    });

    it('should display three establishment types', () => {
        renderWithRouter(<OrientationScolaireHubPage />);
        expect(screen.getByText('Primaire')).toBeInTheDocument();
        expect(screen.getByText('Secondaire')).toBeInTheDocument();
        expect(screen.getByText('Supérieur')).toBeInTheDocument();
    });

    it('should display quick actions', () => {
        renderWithRouter(<OrientationScolaireHubPage />);
        expect(screen.getByText('Actions rapides')).toBeInTheDocument();
        expect(screen.getByText('Concours actifs')).toBeInTheDocument();
        expect(screen.getByText('Conférences')).toBeInTheDocument();
    });
});

