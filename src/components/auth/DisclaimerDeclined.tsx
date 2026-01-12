export function DisclaimerDeclined() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-2xl font-semibold">Access to contex is unavailable</h1>
        <p className="text-xs text-muted-foreground">
          You have declined to accept the disclaimer that is necessary to use contex.
        </p>
        <p className="text-xs text-muted-foreground">
          You can close this page and return another time if you change your mind.
        </p>
      </div>
    </div>
  )
}


