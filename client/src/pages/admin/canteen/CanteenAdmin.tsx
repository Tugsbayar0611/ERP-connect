
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyServingsTab } from "@/components/canteen/DailyServingsTab";
import { WalletsTab } from "@/components/canteen/WalletsTab";
import { MenuTab } from "@/components/canteen/MenuTab";
import { PayrollLinkTab } from "@/components/canteen/PayrollLinkTab";
import { DashboardTab } from "@/components/canteen/DashboardTab";

export default function CanteenAdmin() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("dashboard");

    // Permission check
    if (!user || (user.role !== "Admin" && user.role !== "HR")) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Хандах эрхгүй</h2>
                    <p className="mt-2 text-gray-600">Та энэ хуудсанд нэвтрэх эрхгүй байна.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Цайны газар - Удирдлага</h1>
                <p className="text-muted-foreground">Хоолны бүртгэл, үлдэгдэл хянах, цалингийн суутгал үүсгэх</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="dashboard">Хяналтын самбар</TabsTrigger>
                    <TabsTrigger value="daily">Өдөр тутмын бүртгэл</TabsTrigger>
                    <TabsTrigger value="menu">Цэс</TabsTrigger>
                    <TabsTrigger value="wallets">Дансны үлдэгдэл</TabsTrigger>
                    <TabsTrigger value="payroll">Цалингийн холбоос</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-4">
                    <DashboardTab />
                </TabsContent>

                <TabsContent value="daily" className="space-y-4">
                    <DailyServingsTab />
                </TabsContent>

                <TabsContent value="menu" className="space-y-4">
                    <MenuTab />
                </TabsContent>

                <TabsContent value="wallets" className="space-y-4">
                    <WalletsTab />
                </TabsContent>

                <TabsContent value="payroll" className="space-y-4">
                    <PayrollLinkTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
