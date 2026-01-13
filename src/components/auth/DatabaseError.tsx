import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export function DatabaseError() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Service Unavailable</CardTitle>
          </div>
          <CardDescription>
            contex is currently unavailable. Please try again shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ERR: 5300
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

