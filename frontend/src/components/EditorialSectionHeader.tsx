interface EditorialSectionHeaderProps {
  number: string;
  title: string;
  subtitle?: string;
}

export default function EditorialSectionHeader({ number, title, subtitle }: EditorialSectionHeaderProps) {
  return (
    <div className="ed-section-header">
      <div>
        <span className="ed-section-number">{number}</span>
        <span className="ed-section-title">{title}</span>
      </div>
      {subtitle && <div className="ed-section-subtitle">{subtitle}</div>}
      <div className="ed-section-accent"></div>
    </div>
  );
}
