interface ProcessStatusProps {
  status: string;
  isProcessing: boolean;
}

export default function ProcessStatus({ status, isProcessing }: ProcessStatusProps) {
  return (
    <div className="text-center">
      {isProcessing && (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--morandi-blue)] mx-auto mb-4" />
      )}
      <p className="text-[var(--morandi-brown)]">{status}</p>
    </div>
  );
}