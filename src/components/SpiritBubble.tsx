type Props = {
  message: string | null;
  onClose: () => void;
};

export default function SpiritBubble({ message, onClose }: Props) {
  if (!message) return null;
  return (
    <div className="spirit-bubble" role="status">
      <p>{message}</p>
      <button onClick={onClose} aria-label="Dismiss the spirit's message">
        ×
      </button>
    </div>
  );
}
