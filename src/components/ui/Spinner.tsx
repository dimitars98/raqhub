interface Props {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

const SIZES = {
  sm: "w-5 h-5 border-2",
  md: "w-8 h-8 border-[2.5px]",
  lg: "w-12 h-12 border-[3px]",
};

export default function Spinner({
  label,
  size = "md",
  fullPage = false,
}: Props) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`rounded-full border-orange-100 border-t-orange-400 animate-spin ${SIZES[size]}`}
      />
      {label && (
        <p className="text-sm text-orange-600 animate-pulse">{label}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-[#fff8f2] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">{content}</div>
  );
}
