// ✅ Interface admin pour vérification manuelle KYC
import { Alert, Badge, Button, Card, Modal, Select, Textarea } from '@mantine/core';
import { Check, Eye, Shield, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

interface Document {
    id: number;
    user_id: number;
    user_name?: string;
    user_email?: string;
    user_avatar?: string;
    document_type: string;
    document_url: string;
    document_number?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

interface DocumentDetails extends Document {
    verified_at?: string;
    verified_by?: number;
    rejection_reason?: string;
    expiry_date?: string;
    metadata?: any;
}

const KYCVerificationPage: React.FC = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState<DocumentDetails | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadPendingDocuments();
    }, [page, filterType]);

    const loadPendingDocuments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });
            if (filterType !== 'all') {
                params.append('document_type', filterType);
            }

            const res = await apiGet(`/api/admin/kyc/pending?${params}`);
            const response = await res.json() as {
                success: boolean;
                data: Document[];
                pagination: { page: number; total: number; total_pages: number };
            };

            if (response.success && response.data) {
                setDocuments(response.data);
                setTotalPages(response.pagination?.total_pages || 1);
            }
        } catch (error: unknown) {
            console.error('Erreur chargement documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadDocumentDetails = async (documentId: number) => {
        try {
            const res = await apiGet(`/api/admin/kyc/${documentId}`);
            const response = await res.json() as { success: boolean; data: DocumentDetails };
            if (response.success && response.data) {
                setSelectedDoc(response.data);
                setShowModal(true);
            }
        } catch (error: unknown) {
            console.error('Erreur chargement détails:', error);
        }
    };

    const verifyDocument = async (documentId: number, status: 'approved' | 'rejected') => {
        try {
            setVerifying(true);
            const payload: any = { status };
            if (status === 'rejected' && rejectionReason) {
                payload.rejection_reason = rejectionReason;
            }

            const res = await apiPost(`/api/admin/kyc/${documentId}/verify`, payload);
            await res.json();

            // Recharger la liste
            await loadPendingDocuments();
            setShowModal(false);
            setRejectionReason('');
            setSelectedDoc(null);

            alert(`Document ${status === 'approved' ? 'approuvé' : 'rejeté'} avec succès`);
        } catch (error: unknown) {
            console.error('Erreur vérification:', error);
            const message = error instanceof Error ? error.message : 'Erreur inconnue';
            alert('Erreur lors de la vérification: ' + message);
        } finally {
            setVerifying(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge color="green">Approuvé</Badge>;
            case 'rejected':
                return <Badge color="red">Rejeté</Badge>;
            default:
                return <Badge color="yellow">En attente</Badge>;
        }
    };

    const getDocumentTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            permis: 'Permis de conduire',
            cni: 'Carte Nationale d\'Identité',
            assurance: 'Assurance',
            passeport: 'Passeport',
            carte_grise: 'Carte Grise',
        };
        return labels[type] || type;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={32} />
                    Vérification KYC - Documents en attente
                </h1>

                <Select
                    value={filterType}
                    onChange={(value) => {
                        setFilterType(value || 'all');
                        setPage(1);
                    }}
                    data={[
                        { value: 'all', label: 'Tous les types' },
                        { value: 'permis', label: 'Permis' },
                        { value: 'cni', label: 'CNI' },
                        { value: 'assurance', label: 'Assurance' },
                        { value: 'passeport', label: 'Passeport' },
                    ]}
                    style={{ width: '200px' }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Chargement...</p>
                </div>
            ) : documents.length === 0 ? (
                <Alert color="blue" title="Aucun document en attente">
                    Tous les documents ont été vérifiés.
                </Alert>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {documents.map((doc) => (
                        <Card key={doc.id} shadow="sm" padding="lg" radius="md" withBorder>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                {/* Image du document */}
                                <div style={{ flexShrink: 0 }}>
                                    <img
                                        src={doc.document_url}
                                        alt={doc.document_type}
                                        style={{
                                            width: '150px',
                                            height: '100px',
                                            objectFit: 'cover',
                                            borderRadius: '8px',
                                            border: '1px solid #e0e0e0',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => loadDocumentDetails(doc.id)}
                                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                            (e.target as HTMLImageElement).src = '/logo.png';
                                        }}
                                    />
                                </div>

                                {/* Informations */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div>
                                            <h3 style={{ margin: 0, marginBottom: '4px' }}>
                                                {getDocumentTypeLabel(doc.document_type)}
                                            </h3>
                                            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                                                User ID: {doc.user_id}
                                                {doc.user_name && ` • ${doc.user_name}`}
                                            </p>
                                            {doc.document_number && (
                                                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                                                    N°: {doc.document_number}
                                                </p>
                                            )}
                                        </div>
                                        {getStatusBadge(doc.status)}
                                    </div>

                                    <p style={{ margin: '8px 0', color: '#999', fontSize: '12px' }}>
                                        Soumis le: {new Date(doc.created_at).toLocaleString('fr-FR')}
                                    </p>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                        <Button
                                            leftSection={<Eye size={16} />}
                                            variant="light"
                                            onClick={() => loadDocumentDetails(doc.id)}
                                        >
                                            Voir détails
                                        </Button>
                                        {doc.status === 'pending' && (
                                            <>
                                                <Button
                                                    leftSection={<Check size={16} />}
                                                    color="green"
                                                    onClick={() => verifyDocument(doc.id, 'approved')}
                                                    disabled={verifying}
                                                >
                                                    Approuver
                                                </Button>
                                                <Button
                                                    leftSection={<X size={16} />}
                                                    color="red"
                                                    variant="light"
                                                    onClick={() => {
                                                        setSelectedDoc(doc as DocumentDetails);
                                                        setShowModal(true);
                                                    }}
                                                    disabled={verifying}
                                                >
                                                    Rejeter
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                    <Button
                        variant="light"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Précédent
                    </Button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                        Page {page} / {totalPages}
                    </span>
                    <Button
                        variant="light"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Suivant
                    </Button>
                </div>
            )}

            {/* Modal détails + rejet */}
            <Modal
                opened={showModal}
                onClose={() => {
                    setShowModal(false);
                    setRejectionReason('');
                    setSelectedDoc(null);
                }}
                title={selectedDoc ? `Détails - ${getDocumentTypeLabel(selectedDoc.document_type)}` : 'Détails'}
                size="lg"
            >
                {selectedDoc && (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <img
                                src={selectedDoc.document_url}
                                alt={selectedDoc.document_type}
                                style={{
                                    width: '100%',
                                    maxHeight: '400px',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0',
                                }}
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    (e.target as HTMLImageElement).src = '/logo.png';
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <p><strong>Utilisateur:</strong> {selectedDoc.user_name || `User ID ${selectedDoc.user_id}`}</p>
                            {selectedDoc.user_email && <p><strong>Email:</strong> {selectedDoc.user_email}</p>}
                            {selectedDoc.document_number && (
                                <p><strong>Numéro de document:</strong> {selectedDoc.document_number}</p>
                            )}
                            <p><strong>Statut:</strong> {getStatusBadge(selectedDoc.status)}</p>
                            {selectedDoc.verified_at && (
                                <p><strong>Vérifié le:</strong> {new Date(selectedDoc.verified_at).toLocaleString('fr-FR')}</p>
                            )}
                            {selectedDoc.rejection_reason && (
                                <Alert color="red" title="Raison du rejet" style={{ marginTop: '12px' }}>
                                    {selectedDoc.rejection_reason}
                                </Alert>
                            )}
                        </div>

                        {selectedDoc.status === 'pending' && (
                            <div>
                                <Textarea
                                    label="Raison du rejet (si rejet)"
                                    placeholder="Ex: Document illisible, date d'expiration dépassée..."
                                    value={rejectionReason}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
                                    rows={3}
                                    style={{ marginBottom: '16px' }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <Button
                                        leftSection={<Check size={16} />}
                                        color="green"
                                        onClick={() => verifyDocument(selectedDoc.id, 'approved')}
                                        disabled={verifying}
                                    >
                                        Approuver
                                    </Button>
                                    <Button
                                        leftSection={<X size={16} />}
                                        color="red"
                                        onClick={() => verifyDocument(selectedDoc.id, 'rejected')}
                                        disabled={verifying || (!rejectionReason && true)} // Optionnel: forcer raison
                                    >
                                        Rejeter
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default KYCVerificationPage;
