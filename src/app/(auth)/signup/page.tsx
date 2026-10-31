"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import { syncUserProfile } from "@/lib/firebase/adminService";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // 1️⃣ Create user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2️⃣ Set display name
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // 3️⃣ Sync into Firestore users collection
      await syncUserProfile(userCredential.user.uid, email, name);

      // 4️⃣ Send verification email
      await sendEmailVerification(userCredential.user);

      // 5️⃣ UX message
      setSuccess(
        "Verification email sent. Please check your inbox and verify your email before logging in."
      );

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      switch (authError.code) {
        case "auth/email-already-in-use":
          setError("Email already exists. Please use a different one.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address.");
          break;
        case "auth/weak-password":
          setError("Password should be at least 6 characters.");
          break;
        default:
          setError(authError.message || "An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Create Account
        </h2>
        <p className="mt-2 text-slate-500">
          Access your psychology study materials and notes.
        </p>
      </div>

      <form className="mt-8 space-y-5">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium"
              placeholder="name@company.com"
              required
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
                className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium pr-10"
                placeholder="••••••••"
                required
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
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 text-center font-medium bg-red-50 py-2 rounded-lg border border-red-100"
          >
            {error}
          </motion.p>
        )}

        {/* SUCCESS MESSAGE */}
        {success && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-green-700 text-center font-medium bg-green-50 py-2 rounded-lg border border-green-100"
          >
            {success}
          </motion.p>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={loading}
          onClick={handleSignup}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Get Started"}
        </motion.button>
      </form>

      <p className="text-center text-sm text-slate-600 mt-6 font-medium">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline font-bold">
          Log in
        </Link>
      </p>
    </>
  );
}
