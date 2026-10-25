import { CircleQuestionMark } from "lucide-react";

export default function Help() {
  return (
    <button
      className={`relative grid size-9 place-items-center rounded-lg transition-colors 
         text-ink-400 hover:bg-ink-50 hover:text-ink-900`}
    >
      <CircleQuestionMark className="fill-ink-400 stroke-white" />
    </button>
  );
}
