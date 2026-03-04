interface StepsIndicatorProps {
  currentStep: 1 | 2 | 3
}

const steps = ["Choose cartoon", "Record", "Generate"]

export function StepsIndicator({ currentStep }: StepsIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const completed = stepNum < currentStep
        const active = stepNum === currentStep
        return (
          <span key={label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-black/20">&rarr;</span>}
            <span
              className={
                completed
                  ? "text-black/50"
                  : active
                    ? "text-black"
                    : "text-black/30"
              }
            >
              {completed && (
                <svg
                  className="mr-0.5 inline h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {stepNum}. {label}
            </span>
          </span>
        )
      })}
    </div>
  )
}
