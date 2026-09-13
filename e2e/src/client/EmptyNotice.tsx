interface EmptyNoticeProps {
  readonly subject: string;
}

export default function EmptyNotice({ subject }: EmptyNoticeProps) {
  return <p>No {subject} to show.</p>;
}
