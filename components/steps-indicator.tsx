interface StepsIndicatorProps {
  currentStep: 1 | 2 | 3
}

const steps = ["Choose cartoon", "Record", "Generate"]

export function StepsIndicator({ currentStep }: StepsIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const completed = stepNum < currentStep
        const active = stepNum === currentStep
        return (
          <span key={label} className="flex items-center gap-2">
            {i > 0 && (
              <svg className="h-3 w-3 text-black/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            <span
              className={`flex items-center gap-1 text-[13px] ${
                completed
                  ? "text-black/40"
                  : active
                    ? "font-medium text-black"
                    : "text-black/25"
              }`}
            >
              {completed ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/10">
                  <svg
                    className="h-2.5 w-2.5 text-black/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active ? "bg-black text-white" : "bg-black/5 text-black/30"
                }`}>
                  {stepNum}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}
