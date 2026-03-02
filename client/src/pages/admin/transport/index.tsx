
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Vehicles from "./Vehicles";
import Routes from "./Routes";
import Trips from "./Trips";

export default function AdminTransport() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Тээврийн Удирдлага</h2>
                <p className="text-muted-foreground">Унаа, чиглэл, аялалын хуваарь зохион байгуулах</p>
            </div>

            <Tabs defaultValue="vehicles" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="vehicles">Унаа (Vehicles)</TabsTrigger>
                    <TabsTrigger value="routes">Чиглэл (Routes)</TabsTrigger>
                    <TabsTrigger value="trips">Аялал (Trips)</TabsTrigger>
                </TabsList>

                <TabsContent value="vehicles" className="space-y-4">
                    <Vehicles />
                </TabsContent>

                <TabsContent value="routes" className="space-y-4">
                    <Routes />
                </TabsContent>

                <TabsContent value="trips" className="space-y-4">
                    <Trips />
                </TabsContent>
            </Tabs>
        </div>
    );
}
