import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SigningErrorProps {
  onRetry: () => void
  error?: string
}

export function SigningError({ onRetry, error }: SigningErrorProps) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Unable to Complete Setup</CardTitle>
          </div>
          <CardDescription>
            We were unable to save your disclaimer agreement. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
          )}
          <Button onClick={onRetry} className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

