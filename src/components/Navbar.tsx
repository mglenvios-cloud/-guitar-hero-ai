"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music, Mic2, Home, User } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { name: "Home", href: "/", icon: Home },
    { name: "Music Hero", href: "/hero", icon: Music },
    { name: "AI Studio", href: "/studio", icon: Mic2 },
  ];

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Music className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent">
          NEXUS AUDIO
        </span>
      </div>

      <div className="flex items-center gap-6">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={clsx(
                "relative px-3 py-2 flex items-center gap-2 text-sm font-medium transition-colors hover:text-white",
                isActive ? "text-white" : "text-gray-400"
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.name}
              {isActive && (
                <motion.div
                  layoutId="navbar-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors text-sm font-medium">
          <User className="w-4 h-4" />
          Login
        </button>
      </div>
    </nav>
  );
}
