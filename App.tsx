import React, { useMemo, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ChildSessionScreen } from "./src/screens/ChildSessionScreen";
import { ParentSetupScreen } from "./src/screens/ParentSetupScreen";
import { defaultParentConfig, ParentConfig } from "./src/domain/types";

type AppStep = "parent" | "child";

export default function App() {
  const [step, setStep] = useState<AppStep>("parent");
  const [config, setConfig] = useState<ParentConfig>(defaultParentConfig);

  const childTitle = useMemo(() => {
    return config.childName ? `Session de ${config.childName}` : "Session enfant";
  }, [config.childName]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F4EF" }}>
        <StatusBar style="dark" />
        {step === "parent" ? (
          <ParentSetupScreen
            initialConfig={config}
            onStart={(nextConfig) => {
              setConfig(nextConfig);
              setStep("child");
            }}
          />
        ) : (
          <ChildSessionScreen
            title={childTitle}
            config={config}
            onBackToParent={() => setStep("parent")}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
