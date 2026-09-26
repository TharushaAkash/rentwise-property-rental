import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { Button } from '../../components/ui/Button';

const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

function ReviewHistory({ messages }) {
  return messages.map(message => (
    <div key={message.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 text-sm">
      <p className="whitespace-pre-wrap break-words">{message.message}</p>
      <p className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString()} · {message.status}</p>
      {message.replacementDocumentUrl && (
        <a href={message.replacementDocumentUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 underline">
          View replacement document
        </a>
      )}
    </div>
  ));
}

export function AdminDocumentReviews({ property, onSent }) {
  const propertyId = property.id || property.Id;
  const { data, error, isLoading, refetch } = useFetch(`/property-document-reviews?propertyId=${propertyId}`);
  const [isComposing, setIsComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const messages = Array.isArray(data) ? data : [];
  const pending = messages.some(item => !item.resubmittedAt);
  const documents = property.documents || property.Documents || [];

  const send = async event => {
    event.preventDefault();
    if (!message.trim() || isSending) return;
    setIsSending(true);
    setFeedback('');
    try {
      await api.post('/property-document-reviews', { propertyId, message: message.trim(), documentUrl: documentUrl || null });
      setMessage('');
      setIsComposing(false);
      setFeedback('Message sent. The owner can upload a replacement from My Properties.');
      await refetch();
      onSent?.();
    } catch (err) {
      setFeedback(errorMessage(err, 'Message could not be sent. Please try again.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900">Document messages to owner</h3>
        <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={refetch}>Refresh replies</Button>
        <Button type="button" size="sm" disabled={pending || isLoading || Boolean(error)} onClick={() => setIsComposing(!isComposing)}>
          Request new document
        </Button>
      </div>
      {pending && <p className="text-sm text-amber-900">Waiting for the owner to upload a replacement.</p>}
      {error && <p role="alert" className="text-sm text-red-700">Could not load document requests. <button type="button" onClick={refetch} className="underline">Retry</button></p>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {isComposing && (
        <form onSubmit={send} className="space-y-3">
          <label className="block text-sm font-semibold">
            Document with an issue
            <select className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2" value={documentUrl} disabled={isSending} onChange={e => setDocumentUrl(e.target.value)}>
              <option value="">General request / missing proof</option>
              {documents.map((doc, index) => <option key={doc.id || index} value={doc.documentUrl}>{doc.documentType || 'Document'} {index + 1}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Note to the owner
            <textarea required maxLength={2000} rows={4} disabled={isSending} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Explain the issue and what the replacement document should show."
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 font-normal" />
          </label>
          <p className="text-xs text-gray-600">{message.length}/2000 characters. This message appears in the owner's My Properties inbox.</p>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSending || !message.trim()}>{isSending ? 'Sending…' : 'Send message to owner'}</Button>
            <Button type="button" variant="outline" disabled={isSending} onClick={() => setIsComposing(false)}>Cancel</Button>
          </div>
        </form>
      )}
      <ReviewHistory messages={messages} />
    </section>
  );
}

function OwnerDocumentMessage({ message, onSubmitted }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [feedback, setFeedback] = useState('');
  const submit = async event => {
    event.preventDefault();
    if (!file || isUploading) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setFeedback('Choose a JPG, PNG or WebP image smaller than 10 MB.');
      return;
    }
    setIsUploading(true);
    setFeedback('');
    try {
      let url = uploadedUrl;
      if (!url) {
        const form = new FormData();
        form.append('file', file);
        form.append('documentType', 'OwnershipProof');
        const response = await api.post(`/properties/${message.propertyId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        url = response.data?.documentUrl;
        if (!url) throw new Error('Missing document URL');
        setUploadedUrl(url);
      }
      const response = await api.post(`/properties/${message.propertyId}/proof`, {
        documentType: 'OwnershipProof', documentUrl: url, reviewRequestId: message.id
      });
      setFeedback(response.data?.message || 'Replacement submitted for administrator review.');
      setIsOpen(false);
      await onSubmitted();
    } catch (error) {
      setFeedback(errorMessage(error, 'Could not submit the replacement. Please retry.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold text-gray-900">{message.propertyTitle}</h3>
        <span className="text-xs font-semibold text-amber-800">{message.resubmittedAt ? 'Replacement submitted' : 'Action required'}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
      <p className="text-xs text-gray-500">From administrator · {new Date(message.createdAt).toLocaleString()}</p>
      {message.documentUrl && <a href={message.documentUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-indigo-700 underline">View document with issue</a>}
      {!message.resubmittedAt && !isOpen && <Button type="button" size="sm" onClick={() => setIsOpen(true)}>Upload replacement</Button>}
      {isOpen && !message.resubmittedAt && (
        <form onSubmit={submit} className="space-y-3 pt-2">
          <label className="block text-sm font-semibold">Replacement document
            <input type="file" accept="image/jpeg,image/png,image/webp" required disabled={isUploading}
              onChange={event => { setFile(event.target.files?.[0] || null); setUploadedUrl(''); setFeedback(''); }}
              className="mt-1 block w-full text-sm" />
          </label>
          <p className="text-xs text-gray-600">Upload a clear JPG, PNG or WebP photo, up to 10 MB.</p>
          <div className="flex gap-2">
            <Button type="submit" disabled={!file || isUploading}>{isUploading ? 'Uploading and checking…' : 'Submit replacement'}</Button>
            <Button type="button" variant="outline" disabled={isUploading} onClick={() => setIsOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {feedback && <p role="status" className="text-sm text-gray-700">{feedback}</p>}
    </article>
  );
}

export function OwnerDocumentMessages({ onSubmitted }) {
  const { data, error, isLoading, refetch } = useFetch('/property-document-reviews');
  useEffect(() => {
    const refresh = () => { if (!document.hidden) refetch(); };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, [refetch]);
  const messages = Array.isArray(data) ? data : [];
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg">Document messages <span className="text-sm text-amber-800">({messages.filter(item => !item.resubmittedAt).length} awaiting upload)</span></h2>
        <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={refetch}>Refresh</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">Could not load your messages. Please refresh to try again.</p>
        : messages.length === 0 && <p className="text-sm text-gray-600">{isLoading ? 'Loading messages…' : 'No document requests from the administrator.'}</p>}
      {messages.map(message => <OwnerDocumentMessage key={message.id} message={message} onSubmitted={async () => { await refetch(); onSubmitted?.(); }} />)}
    </section>
  );
}
