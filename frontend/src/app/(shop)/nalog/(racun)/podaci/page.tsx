import type { Metadata } from "next";
import { currentCustomer } from "@/lib/shop-api";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const metadata: Metadata = { title: "Lični podaci" };

export default async function ProfilePage() {
  const customer = (await currentCustomer())!;
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Lični podaci i adresa</h1>
      <ProfileForm
        name={customer.name}
        email={customer.email}
        phone={customer.phone ?? ""}
        deliveryAddress={customer.deliveryAddress ?? ""}
      />
      <PasswordForm />
    </>
  );
}
