type Props = {
  hasSave: boolean;
  onStart: () => void;
};

export default function TitleScreen({ hasSave, onStart }: Props) {
  return (
    <div className="title-screen">
      <h1>Little World</h1>
      <p>Take care of yourself. Watch what grows.</p>
      <button onClick={onStart}>{hasSave ? "Continue" : "Start"}</button>
    </div>
  );
}
