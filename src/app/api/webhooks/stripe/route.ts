import { prisma } from "@/db/prisma";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { use } from "react";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_KEY!;

export async function POST(req: Request) {
    const body = await req.text();
    debugger;
    const sig = await req.headers.get("stripe-signature")!;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
    } catch (e) {
        console.log('WebHook Signature Validation Failed', e);
        return new Response('Webhook Error ' + e, { status: 400 })
    }


    //Handle The Event
    try {

        switch (event.type) {
            case "checkout.session.completed":
                const session = await stripe.checkout.sessions.retrieve(
                    (event.data.object as Stripe.Checkout.Session).id,
                    {
                        expand: ['line_items.data.price']
                    }
                );
                const customerId = session.customer as string;

                const customerDetails = session.customer_details;

                if (customerDetails?.email) {
                    const user = await prisma.user.findUnique({ where: { email: customerDetails.email } });
                    if (!user) {
                        throw new Error("User not found in DB");
                    }
                    if (!user.customerId) {
                        await prisma.user.update({
                            data: {
                                customerId: customerId
                            },
                            where: {
                                id: user.id
                            }
                        })
                    }
                    const lineItems = session.line_items?.data || [];
                    for (const item of lineItems) {
                        const priceId = item.price?.id;
                        const isSubscription = item.price?.type == "recurring";
                        if (isSubscription) {
                            let endDate = new Date();
                            if (priceId == process.env.STRIPE_YEARLY_PRICE_ID!) {
                                endDate.setFullYear(endDate.getFullYear() + 1)
                            }
                            else if (priceId == process.env.STRIPE_MONTHLY_PRICE_ID!) {
                                endDate.setMonth(endDate.getMonth() + 1)
                            }
                            else {
                                throw new Error("Invalid Price Id");
                            }

                            await prisma.subsctiption.upsert({
                                where: {
                                    userId: user.id!,
                                },
                                create: {
                                    userId: user.id,
                                    startDate: new Date(),
                                    endDate,
                                    plan: "premium",
                                    period: priceId == process.env.STRIPE_YEARLY_PRICE_ID! ? "yearly" : "monthly",
                                },
                                update: {
                                    startDate: new Date(),
                                    endDate,
                                    plan: "premium",
                                    period: priceId == process.env.STRIPE_YEARLY_PRICE_ID! ? "yearly" : "monthly",
                                }
                            })
                            await prisma.user.update({
                                where: {
                                    id: user.id,
                                },
                                data: {
                                    plan: "premium"
                                }
                            })

                        } else {

                        }
                    }
                }
                break;
            default:
                console.log("Unhandled Event Type " + event.type);
        }

    } catch (e) {
        console.log('Error Handling Event', e);
        return new Response('Webhook Error ' + e, { status: 400 })
    }

    return new Response('Webhook Received ', { status: 200 })
}