/**
 * Payments API
 */

import { getBrowserClient, getServiceClient } from '../lib/supabase';
import type { Database } from '../types';

type Payment = Database['public']['Tables']['payments']['Row'];

/**
 * Get payment history for current user
 */
export async function getPaymentHistory(
  options?: {
    from?: string;
    to?: string;
    limit?: number;
  }
): Promise<Payment[]> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return [];

  let query = client
    .from('payments')
    .select(`
      *,
      listings(title, area, listing_number)
    `)
    .eq('seller_id', user.data.user.id)
    .order('created_at', { ascending: false });

  if (options?.from) {
    query = query.gte('created_at', options.from);
  }
  if (options?.to) {
    query = query.lte('created_at', options.to);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load payment history: ${error.message}`);
  }

  return (data ?? []) as Payment[];
}

/**
 * Get payment summary
 */
export async function getPaymentSummary(): Promise<{
  totalPaid: number;
  totalPending: number;
  totalRefunded: number;
  count: number;
}> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) {
    return { totalPaid: 0, totalPending: 0, totalRefunded: 0, count: 0 };
  }

  const { data, error } = await client
    .from('payments')
    .select('amount, status')
    .eq('seller_id', user.data.user.id);

  if (error) {
    return { totalPaid: 0, totalPending: 0, totalRefunded: 0, count: 0 };
  }

  let totalPaid = 0;
  let totalPending = 0;
  let totalRefunded = 0;

  data?.forEach(p => {
    const amount = Number(p.amount) || 0;
    if (p.status === 'completed') totalPaid += amount;
    else if (p.status === 'pending') totalPending += amount;
    else if (p.status === 'refunded') totalRefunded += amount;
  });

  return {
    totalPaid,
    totalPending,
    totalRefunded,
    count: data?.length ?? 0,
  };
}

/**
 * Initiate M-Pesa STK push
 */
export async function initiateMpesaPayment(
  phoneNumber: string,
  amount: number,
  reference: string,
  description: string
): Promise<{ checkoutRequestId: string; error: Error | null }> {
  const client = getServiceClient();

  const { data, error } = await client.functions.invoke('mpesa-stk-push', {
    body: {
      phone: phoneNumber,
      amount,
      reference,
      description,
    },
  });

  if (error) {
    return { checkoutRequestId: '', error: new Error(error.message) };
  }

  return { checkoutRequestId: data?.checkoutRequestId ?? '', error: null };
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(
  checkoutRequestId: string
): Promise<{ status: string; error: Error | null }> {
  const client = getServiceClient();

  const { data, error } = await client.functions.invoke('mpesa-check-status', {
    body: { checkoutRequestId },
  });

  if (error) {
    return { status: 'unknown', error: new Error(error.message) };
  }

  return { status: data?.status ?? 'unknown', error: null };
}

/**
 * Export payments to CSV
 */
export async function exportPaymentsCSV(
  options?: { from?: string; to?: string }
): Promise<string> {
  const payments = await getPaymentHistory(options);

  const headers = ['Date', 'Listing', 'Reference', 'Amount', 'Status', 'Method'];
  const rows = payments.map(p => [
    new Date(p.created_at).toLocaleDateString('en-KE'),
    p.listings?.title ?? `Listing #${p.listings?.listing_number ?? 'N/A'}`,
    p.reference,
    `KES ${Number(p.amount).toLocaleString('en-KE')}`,
    p.status,
    p.payment_method ?? 'M-Pesa',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}