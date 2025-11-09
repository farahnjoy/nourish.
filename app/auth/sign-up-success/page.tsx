import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-semibold text-3xl text-foreground mb-2">nourish.</h1>
        </div>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>We&apos;ve sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please check your email and click the confirmation link to activate your account. Once confirmed, you can
              log in and start tracking your nutrition.
            </p>
            <Button asChild className="w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/auth/login">Back to Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
