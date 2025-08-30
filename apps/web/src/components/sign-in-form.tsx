import { authClient } from "@/lib/auth-client";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import Loader from "./loader";
import { Button } from "./ui/button";

export default function SignInForm() {
  const navigate = useNavigate({
    from: "/",
  });
  const search = useSearch({ from: "/login" });
  const { data: session, isPending } = authClient.useSession();
  
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSigningInWithNear, setIsSigningInWithNear] = useState(false);
  const [isDisconnectingWallet, setIsDisconnectingWallet] = useState(false);
  
  // Get account ID directly from the SIWN client
  const accountId = authClient.near.getAccountId();

  const handleWalletConnect = async () => {
    setIsConnectingWallet(true);
    try {
      await authClient.requestSignIn.near(
        { recipient: "every-rss-feed.near" },
        {
          onSuccess: () => {
            setIsConnectingWallet(false);
            toast.success(`Wallet connected`);
          },
          onError: (error: any) => {
            setIsConnectingWallet(false);
            console.error("Wallet connection failed:", error);
            const errorMessage = error.code === "SIGNER_NOT_AVAILABLE"
              ? "NEAR wallet not available"
              : error.message || "Failed to connect wallet";
            toast.error(errorMessage);
          },
        }
      );
    } catch (error) {
      setIsConnectingWallet(false);
      console.error("Wallet connection error:", error);
      toast.error("Failed to connect to NEAR wallet");
    }
  };

  const handleNearSignIn = async () => {
    setIsSigningInWithNear(true);
    try {
      await authClient.signIn.near(
        { recipient: "every-rss-feed.near" },
        {
          onSuccess: () => {
            setIsSigningInWithNear(false);
            navigate({
              to: search.redirect || "/dashboard",
              replace: true,
            });
            toast.success(`Signed in as: ${accountId}`);
          },
          onError: (error) => {
            setIsSigningInWithNear(false);
            console.error("NEAR sign in error:", error);
            
            if ((error as any)?.code === "NONCE_NOT_FOUND") {
              toast.error("Session expired. Please reconnect your wallet.");
              handleWalletDisconnect();
              return;
            }
            
            toast.error(
              error instanceof Error ? error.message : "Authentication failed"
            );
          },
        }
      );
    } catch (error) {
      setIsSigningInWithNear(false);
      console.error("NEAR sign in error:", error);
      
      if ((error as any)?.code === "NONCE_NOT_FOUND") {
        toast.error("Session expired. Please reconnect your wallet.");
        handleWalletDisconnect();
        return;
      }
      
      toast.error("Authentication failed");
    }
  };

  const handleWalletDisconnect = async () => {
    setIsDisconnectingWallet(true);
    try {
      await authClient.signOut();
      await authClient.near.disconnect();
      setIsDisconnectingWallet(false);
      toast.success("Wallet disconnected successfully");
    } catch (error) {
      setIsDisconnectingWallet(false);
      console.error("Wallet disconnect error:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-card border rounded-lg shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-3 sm:mb-4">
            Sign in with NEAR
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Connect your NEAR wallet to authenticate securely
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {!accountId ? (
            <Button
              type="button"
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium touch-manipulation"
              onClick={handleWalletConnect}
              disabled={isConnectingWallet}
            >
              {isConnectingWallet
                ? "Connecting Wallet..."
                : "Connect NEAR Wallet"}
            </Button>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <Button
                type="button"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium touch-manipulation"
                onClick={handleNearSignIn}
                disabled={isSigningInWithNear}
              >
                {isSigningInWithNear
                  ? "Signing in..."
                  : `Sign in with NEAR (${accountId})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium touch-manipulation"
                onClick={handleWalletDisconnect}
                disabled={isDisconnectingWallet}
              >
                {isDisconnectingWallet
                  ? "Disconnecting..."
                  : "Disconnect Wallet"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            This demo uses fastintear for wallet connectivity.
          </p>
        </div>
      </div>
    </div>
  );
}
