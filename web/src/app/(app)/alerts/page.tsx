"use client";
/**
 * Alerts center — list + preference form (P0 #3).
 */
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { AlertBanner } from "@/components/alert/AlertBanner";
import { AlertList } from "@/components/alert/AlertList";
import { AlertPrefForm } from "@/components/alert/AlertPrefForm";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader title="Alerts Center" subtitle="Public alerts and monitoring preferences" />
      <AlertBanner />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Active Alerts">
            <AlertList />
          </Card>
        </div>
        <div>
          <Card>
            <AlertPrefForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
