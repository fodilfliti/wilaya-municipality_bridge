export function FormErrorBlock({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="formErrorBlock" role="alert">
      {message}
    </div>
  )
}

export function FieldErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fieldError" role="alert">
      {message}
    </div>
  )
}
