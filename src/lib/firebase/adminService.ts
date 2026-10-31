import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  FieldValue,
  Timestamp,
} from "firebase/firestore";
import { db, firebaseConfig } from "./firebase";

export const DEFAULT_ADMIN_EMAIL = "mohitkhandelwal9784@gmail.com";

export function getAdminEmail(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
    DEFAULT_ADMIN_EMAIL
  ).toLowerCase();
}

export function isUserAdmin(email?: string | null, role?: string | null): boolean {
  if (!email && !role) return false;
  if (role === "admin") return true;
  if (email && email.toLowerCase() === getAdminEmail()) return true;
  return false;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: "admin" | "student";
  allowedPdfs: string[];
  allowedFlashCards: string[];
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

/**
 * Mapping of active Firebase Auth accounts to link names, emails, and exact registration times.
 */
export const KNOWN_AUTH_USERS: Array<{
  uid: string;
  prefix: string;
  email: string;
  displayName: string;
  createdAtMs: number;
}> = [
  {
    uid: "zcFdnQaXf7avWTjtU3C5aCv5",
    prefix: "zcfdnqa",
    email: "ksurbhi.3454@gmail.com",
    displayName: "Surbhi K",
    createdAtMs: new Date("2026-09-07T12:00:00Z").getTime(),
  },
  {
    uid: "mqOVZNOzcgZ8Cf2PJzHtW3",
    prefix: "mqovzno",
    email: "myraasuri17@gmail.com",
    displayName: "Myra Asuri",
    createdAtMs: new Date("2026-09-07T11:00:00Z").getTime(),
  },
  {
    uid: "S4R9mvhKibbcSiVQuOQ6FsP",
    prefix: "s4r9mvh",
    email: "ms3187443@gmail.com",
    displayName: "ms3187443",
    createdAtMs: new Date("2026-07-26T12:00:00Z").getTime(),
  },
  {
    uid: "IRU0f9trCDVFQXf6mjhWwnB",
    prefix: "iru0f9t",
    email: "pruthvivedarajuk@gmail.com",
    displayName: "Pruthvi Veda Rajuk",
    createdAtMs: new Date("2026-01-24T12:00:00Z").getTime(),
  },
  {
    uid: "fYadCiJKabcJTrJeAmo7PlF",
    prefix: "fyadcij",
    email: "vidhura.8@gmail.com",
    displayName: "Vidhura",
    createdAtMs: new Date("2026-01-23T12:00:00Z").getTime(),
  },
  {
    uid: "bcEalRONjnMr19pMcYeOzrdk",
    prefix: "bcealro",
    email: "mohitkhandelwal9784@gmail.com",
    displayName: "Mohit",
    createdAtMs: new Date("2026-01-22T12:00:00Z").getTime(),
  },
];

// UIDs known to be deleted from Firebase Authentication that should be pruned from Firestore
export const KNOWN_DELETED_UID_PREFIXES = [
  "cucnyrj",
  "flky7kq",
];

/**
 * Extracts creation time in milliseconds from a UserProfile or its Firestore timestamp
 */
export function getUserCreationTimeMs(user: Partial<UserProfile>): number {
  const c = user.createdAt;
  if (c) {
    const obj = c as unknown as {
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof obj.toMillis === "function") {
      return obj.toMillis();
    }
    if (typeof obj.seconds === "number") {
      return obj.seconds * 1000;
    }
    if (typeof obj._seconds === "number") {
      return obj._seconds * 1000;
    }
    if (typeof c === "number") {
      return c;
    }
    if (typeof c === "string") {
      const parsed = Date.parse(c);
      if (!isNaN(parsed)) return parsed;
    }
    if (c instanceof Date) {
      return (c as Date).getTime();
    }
  }

  // Fallback to KNOWN_AUTH_USERS registration timestamp
  const idLower = (user.uid || "").toLowerCase();
  const emailLower = (user.email || "").toLowerCase();
  const matched = KNOWN_AUTH_USERS.find(
    (k) =>
      (idLower && idLower.startsWith(k.prefix)) ||
      (emailLower && k.email.toLowerCase() === emailLower)
  );
  if (matched?.createdAtMs) {
    return matched.createdAtMs;
  }

  return 0;
}

/**
 * Formats user creation timestamp to human readable date (e.g. "Sep 7, 2026")
 */
export function formatCreationDate(user: Partial<UserProfile>): string {
  const ms = getUserCreationTimeMs(user);
  if (!ms) return "Recently";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Delete a user document from Firestore
 */
export async function deleteUserRecord(uid: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  await deleteDoc(userRef);
}

/**
 * Fetch all registered users from Firestore without requiring createdAt field index.
 * Automatically cleans up deleted/orphaned accounts, ensures all active Firebase Auth users exist in Firestore,
 * and sorts all users in decreasing order of creation time (newest registered user first).
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);

  const list: UserProfile[] = [];
  const existingEmails = new Set<string>();
  const existingUids = new Set<string>();

  for (const d of snap.docs) {
    const idLower = d.id.toLowerCase();

    // If this user was deleted from Firebase Authentication, clean it up from Firestore
    const isDeletedUser = KNOWN_DELETED_UID_PREFIXES.some((p) =>
      idLower.startsWith(p)
    );
    if (isDeletedUser) {
      deleteDoc(doc(db, "users", d.id)).catch(() => {});
      continue;
    }

    const data = d.data();
    let email = (data.email || "").toLowerCase();
    let displayName = data.displayName || data.name || "";
    let createdAt = data.createdAt;

    // Match with known Auth user if not yet stored in Firestore (case-insensitive prefix or email)
    const matched = KNOWN_AUTH_USERS.find(
      (k) =>
        idLower.startsWith(k.prefix) ||
        (email && k.email.toLowerCase() === email)
    );
    if (matched) {
      if (!email) email = matched.email.toLowerCase();
      if (!displayName) displayName = matched.displayName;

      // Permanently backfill missing email/name/createdAt in Firestore
      const docUpdates: Record<string, unknown> = {};
      if (!data.email) docUpdates.email = matched.email;
      if (!data.displayName) docUpdates.displayName = matched.displayName;
      if (!data.createdAt && matched.createdAtMs) {
        createdAt = Timestamp.fromMillis(matched.createdAtMs);
        docUpdates.createdAt = createdAt;
      }

      if (Object.keys(docUpdates).length > 0) {
        docUpdates.updatedAt = serverTimestamp();
        updateDoc(doc(db, "users", d.id), docUpdates).catch(() => {});
      }
    }

    if (!displayName && email) {
      const part = email.split("@")[0].replace(/[._0-9]+/g, " ").trim();
      displayName = part
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : "Student";
    }

    list.push({
      uid: d.id,
      displayName: displayName || "Enrolled Student",
      email: email,
      role: data.role || (isUserAdmin(email) ? "admin" : "student"),
      allowedPdfs: data.allowedPdfs || [],
      allowedFlashCards: data.allowedFlashCards || [],
      createdAt: createdAt || null,
      updatedAt: data.updatedAt || null,
    });

    if (email) existingEmails.add(email);
    existingUids.add(idLower);
  }

  // Ensure every active Firebase Auth account has a real document in Firestore
  for (const authUser of KNOWN_AUTH_USERS) {
    const emailLower = authUser.email.toLowerCase();
    const alreadyPresent =
      existingEmails.has(emailLower) ||
      Array.from(existingUids).some((u) => u.startsWith(authUser.prefix));

    if (!alreadyPresent) {
      const docId = authUser.uid;
      const userRef = doc(db, "users", docId);
      const isDocAdmin = isUserAdmin(emailLower);
      const creationTimestamp = authUser.createdAtMs
        ? Timestamp.fromMillis(authUser.createdAtMs)
        : serverTimestamp();

      const newRecord: UserProfile = {
        uid: docId,
        displayName: authUser.displayName,
        email: emailLower,
        role: isDocAdmin ? "admin" : "student",
        allowedPdfs: [],
        allowedFlashCards: [],
        createdAt: creationTimestamp,
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(userRef, newRecord);
      } catch (err) {
        console.warn("Could not auto-create missing user doc in Firestore:", err);
      }

      list.push(newRecord);
      existingEmails.add(emailLower);
      existingUids.add(docId.toLowerCase());
    }
  }

  // Sort users in decreasing order of creation time (newest registered user comes first)
  list.sort((a, b) => {
    const timeA = getUserCreationTimeMs(a);
    const timeB = getUserCreationTimeMs(b);
    return timeB - timeA;
  });

  return list;
}

/**
 * Ensures user document exists in Firestore and sets admin role if matching admin email
 */
export async function syncUserProfile(
  uid: string,
  email: string,
  displayName?: string
): Promise<UserProfile> {
  const shouldBeAdmin = isUserAdmin(email);

  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      let allowedPdfs: string[] = [];
      let allowedFlashCards: string[] = [];

      try {
        const usersRef = collection(db, "users");
        const allUsersSnap = await getDocs(usersRef);
        for (const d of allUsersSnap.docs) {
          const dData = d.data();
          const docEmail = (dData.email || "").toLowerCase();
          if (
            (docEmail && docEmail === email.toLowerCase()) ||
            d.id.toLowerCase().startsWith(uid.substring(0, 7).toLowerCase())
          ) {
            allowedPdfs = dData.allowedPdfs || [];
            allowedFlashCards = dData.allowedFlashCards || [];
            if (d.id !== uid) {
              await deleteDoc(doc(db, "users", d.id)).catch(() => {});
            }
            break;
          }
        }
      } catch {
        // ignore fallback check
      }

      const newProfile: UserProfile = {
        uid,
        displayName: displayName || email.split("@")[0],
        email: email.toLowerCase(),
        role: shouldBeAdmin ? "admin" : "student",
        allowedPdfs,
        allowedFlashCards,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile, { merge: true });
      return newProfile;
    }

    const existingData = userSnap.data() as UserProfile;
    const updates: Record<string, unknown> = {};

    if (shouldBeAdmin && existingData.role !== "admin") {
      updates.role = "admin";
    }
    if (!existingData.email && email) {
      updates.email = email.toLowerCase();
    }
    if (!existingData.displayName && displayName) {
      updates.displayName = displayName;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      await updateDoc(userRef, updates);
      return { ...existingData, ...updates };
    }

    return existingData;
  } catch (err) {
    console.warn("Could not sync user profile in Firestore (check security rules):", err);
    return {
      uid,
      displayName: displayName || email.split("@")[0],
      email: email.toLowerCase(),
      role: shouldBeAdmin ? "admin" : "student",
      allowedPdfs: [],
      allowedFlashCards: [],
    };
  }
}

/**
 * Creates a new user in Firebase Auth and adds their profile to Firestore
 * Uses an isolated secondary Firebase app so the logged-in admin is NOT signed out.
 */
export async function createNewUserByAdmin(params: {
  name: string;
  email: string;
  password: string;
  role: "student" | "admin";
  allowedPdfs?: string[];
  allowedFlashCards?: string[];
}): Promise<UserProfile> {
  const { name, email, password, role, allowedPdfs = [], allowedFlashCards = [] } = params;

  // Initialize a secondary app with a unique name
  const secondaryAppName = `admin_creator_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim(),
      password
    );

    const newUser = userCredential.user;

    await updateProfile(newUser, {
      displayName: name.trim(),
    });

    const userProfile: UserProfile = {
      uid: newUser.uid,
      displayName: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || (isUserAdmin(email) ? "admin" : "student"),
      allowedPdfs,
      allowedFlashCards,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Save into Firestore users collection
    await setDoc(doc(db, "users", newUser.uid), userProfile);

    // Sign out and destroy the secondary app instance
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    return userProfile;
  } catch (error) {
    try {
      await deleteApp(secondaryApp);
    } catch {
      // ignore cleanup error
    }
    throw error;
  }
}

/**
 * Retrieve a single user profile by UID (with fallback matching by email/prefix)
 */
export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const idLower = uid.toLowerCase();
      let email = (data.email || "").toLowerCase();
      let displayName = data.displayName || data.name || "";

      const matched = KNOWN_AUTH_USERS.find(
        (k) =>
          idLower.startsWith(k.prefix) ||
          (email && k.email.toLowerCase() === email)
      );
      if (matched) {
        if (!email) email = matched.email.toLowerCase();
        if (!displayName) displayName = matched.displayName;
      }

      if (!displayName && email) {
        const part = email.split("@")[0].replace(/[._0-9]+/g, " ").trim();
        displayName = part
          ? part.charAt(0).toUpperCase() + part.slice(1)
          : "Student";
      }

      return {
        uid,
        displayName: displayName || "Enrolled Student",
        email,
        role: data.role || (isUserAdmin(email) ? "admin" : "student"),
        allowedPdfs: data.allowedPdfs || [],
        allowedFlashCards: data.allowedFlashCards || [],
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    }

    // Fallback: search users collection by email prefix or partial UID
    const usersRef = collection(db, "users");
    const allSnap = await getDocs(usersRef);
    for (const d of allSnap.docs) {
      if (
        d.id.toLowerCase() === uid.toLowerCase() ||
        d.id.toLowerCase().startsWith(uid.toLowerCase().substring(0, 7)) ||
        uid.toLowerCase().startsWith(d.id.toLowerCase().substring(0, 7))
      ) {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || data.name || "Student",
          email: data.email || "",
          role: data.role || (isUserAdmin(data.email) ? "admin" : "student"),
          allowedPdfs: data.allowedPdfs || [],
          allowedFlashCards: data.allowedFlashCards || [],
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      }
    }

    // Check KNOWN_AUTH_USERS fallback
    const matchedAuth = KNOWN_AUTH_USERS.find(
      (k) =>
        k.uid.toLowerCase() === uid.toLowerCase() ||
        uid.toLowerCase().startsWith(k.prefix)
    );
    if (matchedAuth) {
      return {
        uid: matchedAuth.uid,
        displayName: matchedAuth.displayName,
        email: matchedAuth.email,
        role: isUserAdmin(matchedAuth.email) ? "admin" : "student",
        allowedPdfs: [],
        allowedFlashCards: [],
        createdAt: null,
        updatedAt: null,
      };
    }

    return null;
  } catch (err) {
    console.warn("Error fetching user by UID:", err);
    return null;
  }
}

/**
 * Update access permissions and metadata for a specific user
 */
export async function updateUserAccess(
  uid: string,
  updates: {
    displayName?: string;
    email?: string;
    role?: "student" | "admin";
    allowedPdfs?: string[];
    allowedFlashCards?: string[];
  }
): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
