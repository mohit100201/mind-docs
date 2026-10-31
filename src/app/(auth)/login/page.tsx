"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import { isUserAdmin, syncUserProfile } from "@/lib/firebase/adminService";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const isAdmin = isUserAdmin(currentUser.email);
        if (isAdmin || currentUser.emailVerified) {
          const profile = await syncUserProfile(
            currentUser.uid,
            currentUser.email || "",
            currentUser.displayName || ""
          );

          if (profile.role === "admin" || isAdmin) {
            router.replace("/admin");
          } else {
            router.replace("/dashboard");
          }
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const cleanEmail = email.trim();
    const isAdminTarget = isUserAdmin(cleanEmail);

    try {
      let res;
      try {
        res = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: unknown) {
        const errObj = authErr as { code?: string; message?: string };
        // If this is the designated admin account and it doesn't exist yet, auto-provision it
        if (
          isAdminTarget &&
          (errObj.code === "auth/user-not-found" ||
            errObj.code === "auth/invalid-credential")
        ) {
          try {
            res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            await updateProfile(res.user, { displayName: "Admin" });
          } catch {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      // Sync user profile in Firestore
      const profile = await syncUserProfile(
        res.user.uid,
        res.user.email || cleanEmail,
        res.user.displayName || (isAdminTarget ? "Admin" : "")
      );

      const isActuallyAdmin = profile.role === "admin" || isAdminTarget;

      // 🚫 BLOCK unverified regular students (exempt admin)
      if (!isActuallyAdmin && !res.user.emailVerified) {
        await sendEmailVerification(res.user);
        setError(
          "Your email is not verified. We've re-sent the verification email. Please verify before logging in."
        );
        return;
      }

      // Route according to role
      if (isActuallyAdmin) {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      switch (authError.code) {
        case "auth/user-not-found":
          setError("User not found. Please sign up for an account.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password. Please try again.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/invalid-credential":
          setError("Invalid login credentials. Please check your email and password.");
          break;
        default:
          setError(authError.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Sign in
        </h2>
        <p className="mt-2 text-slate-500">
          Welcome back! Please enter your details.
        </p>
      </div>

      <form className="mt-8 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        {/* INFO MESSAGE */}
        {info && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-sm text-center font-medium"
          >
            {info}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={handleSignIn}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Sign In"}
        </motion.button>
      </form>

      <p className="text-center text-sm text-slate-600 mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-bold text-indigo-600 hover:underline"
        >
          Sign up for free
        </Link>
      </p>
    </>
  );
}
