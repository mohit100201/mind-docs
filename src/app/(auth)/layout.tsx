"use client";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
const isSignup = pathname === "/signup";
console.log("pathname:", pathname);


  const bgImage = isSignup ? "/signup.jpg" : "/signin.jpg";

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side: Image Section */}
      <div className="relative hidden w-1/2 lg:block overflow-hidden bg-slate-900">
        <AnimatePresence mode="wait">
          {/* Key is the most important part - it forces the refresh */}
          <motion.div
            key={pathname} 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <Image
              src={bgImage}
              alt="Auth Background"
              fill
              className="object-cover"
              priority
              sizes="50vw"
            />
            {/* Darker gradient for better text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent opacity-90" />
          </motion.div>
        </AnimatePresence>

        {/* Floating Text Overlay */}
        <div className="absolute bottom-20 left-12 right-12 text-white z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={isSignup ? "signup-txt" : "signin-txt"}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-5xl font-extrabold leading-tight">
                {isSignup ? "Create your \naccount today." : "Welcome back \nto the community."}
              </h1>
              <p className="mt-4 text-lg text-slate-300 max-w-sm">
                {isSignup 
                  ? "Join us and start managing your projects with our modern toolset." 
                  : "Sign in to access your personalized dashboard and team updates."}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right Side: Form Content */}
      <main className="flex w-full items-center justify-center lg:w-1/2 p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 shadow-2xl shadow-slate-200 border border-slate-100"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}