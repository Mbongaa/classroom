import Stripe from 'stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';

interface InvoiceHistoryCardProps {
  invoices: Stripe.Invoice[];
}

export function InvoiceHistoryCard({ invoices }: InvoiceHistoryCardProps) {
  // Empty state if no invoices
  if (!invoices || invoices.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">No invoices yet</p>
            <p className="text-gray-500 text-xs mt-1">
              Invoices will appear here after your first payment
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get status badge for invoice
  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      paid: {
        label: 'Paid',
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
      },
      open: {
        label: 'Open',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      },
      draft: {
        label: 'Draft',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      },
      uncollectible: {
        label: 'Uncollectible',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
      },
      void: {
        label: 'Void',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      },
    };

    const config = statusConfig[status || 'open'] || statusConfig.open;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Format amount
  const formatAmount = (amount: number | null, currency: string) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Format date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800/50">
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Amount</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Invoice</TableHead>
                <TableHead className="text-gray-400 text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="text-white">
                    {formatDate(invoice.created)}
                  </TableCell>
                  <TableCell className="text-white font-medium">
                    {formatAmount(invoice.amount_paid, invoice.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-gray-400 font-mono text-xs">
                    {invoice.number || invoice.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right">
                    {invoice.invoice_pdf ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        asChild
                      >
                        <a
                          href={invoice.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          PDF
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Showing {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
        </p>
      </CardContent>
    </Card>
  );
}
