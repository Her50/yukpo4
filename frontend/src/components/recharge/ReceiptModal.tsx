import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserCredit } from '@/hooks/useUserCredit';
import { useUser } from '@/hooks/useUser';
import { CheckCircle, Download, Printer, X } from 'lucide-react';
import React, { useRef } from 'react';

interface ReceiptData {
  id: string;
  amount: number;
  tokens: number;
  bonus: number;
  paymentMethod: string;
  transactionId: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData
}) => {
  const { user } = useUser();
  const { formatAmount } = useUserCredit();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reçu de recharge - Yukpomnang</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .receipt { max-width: 400px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
                .section { margin-bottom: 15px; }
                .label { font-weight: bold; color: #374151; }
                .value { color: #6b7280; }
                .total { border-top: 1px solid #e5e7eb; padding-top: 10px; font-weight: bold; }
                .status { padding: 5px 10px; border-radius: 5px; font-size: 12px; }
                .completed { background-color: #d1fae5; color: #065f46; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownload = () => {
    if (receiptRef.current) {
      const element = receiptRef.current;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reçu de recharge - Yukpomnang</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .receipt { max-width: 400px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
              .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .section { margin-bottom: 15px; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #6b7280; }
              .total { border-top: 1px solid #e5e7eb; padding-top: 10px; font-weight: bold; }
              .status { padding: 5px 10px; border-radius: 5px; font-size: 12px; }
              .completed { background-color: #d1fae5; color: #065f46; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            ${element.innerHTML}
          </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptData.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Reçu de recharge
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div ref={receiptRef} className="receipt">
            <div className="header">
              <div className="logo">Yukpomnang</div>
              <div className="text-sm text-gray-600">Reçu de recharge</div>
            </div>

            <div className="section">
              <div className="label">Client:</div>
              <div className="value">{user?.name || 'Utilisateur'}</div>
            </div>

            <div className="section">
              <div className="label">Email:</div>
              <div className="value">{user?.email || 'N/A'}</div>
            </div>

            <div className="section">
              <div className="label">Date:</div>
              <div className="value">{new Date(receiptData.date).toLocaleString('fr-FR')}</div>
            </div>

            <div className="section">
              <div className="label">ID Transaction:</div>
              <div className="value font-mono text-xs">{receiptData.transactionId}</div>
            </div>

            <div className="section">
              <div className="label">Méthode de paiement:</div>
              <div className="value">{receiptData.paymentMethod}</div>
            </div>

            <div className="section">
              <div className="label">Montant payé:</div>
              <div className="value">{formatAmount(receiptData.amount)}</div>
            </div>

            <div className="section">
              <div className="label">Tokens reçus:</div>
              <div className="value">{receiptData.tokens.toLocaleString()} tokens</div>
            </div>

            {receiptData.bonus > 0 && (
              <div className="section">
                <div className="label">Bonus:</div>
                <div className="value text-green-600">+{receiptData.bonus.toLocaleString()} tokens</div>
              </div>
            )}

            <div className="section total">
              <div className="label">Total tokens:</div>
              <div className="value text-lg">{(receiptData.tokens + receiptData.bonus).toLocaleString()} tokens</div>
            </div>

            <div className="section">
              <div className="label">Statut:</div>
              <div className={`status ${receiptData.status === 'completed' ? 'completed' : ''}`}>
                {receiptData.status === 'completed' ? 'Complété' : 
                 receiptData.status === 'pending' ? 'En attente' : 'Échoué'}
              </div>
            </div>

            <div className="footer">
              <div>Merci d'utiliser Yukpomnang !</div>
              <div>www.yukpomnang.com</div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex-1"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptModal;





