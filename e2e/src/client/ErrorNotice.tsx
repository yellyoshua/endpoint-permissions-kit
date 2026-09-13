interface ErrorNoticeProps {
  readonly code: string;
  readonly message?: string;
  readonly fields?: readonly string[];
  readonly reasons?: readonly string[];
}

export default function ErrorNotice({ code, message, fields, reasons }: ErrorNoticeProps) {
  return (
    <div role="alert" className="error">
      <strong>{code}</strong>
      {message !== undefined && <span> {message}</span>}
      {fields !== undefined && <span> fields: {fields.join(', ')}</span>}
      {reasons !== undefined && (
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
