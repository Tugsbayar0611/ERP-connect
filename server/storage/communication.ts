import {
    companyPosts, postLikes, postComments,
    weatherAlerts, weatherSettings,
    documents, documentLogs, documentReads, companySettings,
    announcements, announcementReads, announcementComments, announcementReactions,
    chatChannels, chatChannelMembers, chatMessages, chatMessageReactions,
    users, employees,
    type CompanyPost, type InsertCompanyPost, type PostLike, type InsertPostLike, type PostComment, type InsertPostComment,
    type DbInsertCompanyPost, type DbInsertPostLike, type DbInsertPostComment,
    type WeatherAlert, type InsertWeatherAlert, type WeatherSettings, type InsertWeatherSettings,
    type DbInsertWeatherAlert, type DbInsertWeatherSettings,
    type Document, type InsertDocument, type DbInsertDocument,
    type DocumentLog, type InsertDocumentLog, type DbInsertDocumentLog,
    type DocumentRead, type InsertDocumentRead, type DbInsertDocumentRead,
    type Announcement, type InsertAnnouncement, type DbInsertAnnouncement,
    type AnnouncementComment, type AnnouncementReaction,
    type ChatChannel, type ChatChannelMember, type ChatMessage, type DbInsertChatMessage,
    type User,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, or, like, sql, inArray, isNull, getTableColumns } from "drizzle-orm";
import { HRStorage } from "./hr";

export class CommunicationStorage extends HRStorage {
    // --- News Feed ---
    async getCompanyPosts(tenantId: string, filters: { limit?: number; search?: string; type?: string; severity?: string } = {}): Promise<any[]> {
        const { limit = 50, search, type, severity } = filters;

        const conditions = [eq(companyPosts.tenantId, tenantId)];

        if (search) {
            const searchCondition = or(
                like(companyPosts.title, `%${search}%`),
                like(companyPosts.content, `%${search}%`)
            );
            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        if (type && type !== 'all') {
            conditions.push(eq(companyPosts.postType, type));
        }

        if (severity && severity !== 'all') {
            conditions.push(eq(companyPosts.severity, severity));
        }

        const posts = await db.select({
            id: companyPosts.id,
            tenantId: companyPosts.tenantId,
            authorId: companyPosts.authorId,
            authorFirstName: sql<string>`${employees.firstName}`,
            authorLastName: sql<string>`${employees.lastName}`,
            title: companyPosts.title,
            content: companyPosts.content,
            postType: companyPosts.postType,
            severity: companyPosts.severity,
            images: companyPosts.images,
            files: companyPosts.files,
            actions: companyPosts.actions,
            likesCount: companyPosts.likesCount,
            commentsCount: companyPosts.commentsCount,
            isPinned: companyPosts.isPinned,
            createdAt: companyPosts.createdAt,
        })
            .from(companyPosts)
            .leftJoin(employees, eq(companyPosts.authorId, employees.id))
            .where(and(...conditions))
            .orderBy(desc(companyPosts.isPinned), desc(companyPosts.createdAt))
            .limit(limit);

        return posts.map((post: any) => ({
            ...post,
            authorName: `${post.authorFirstName || ""} ${post.authorLastName || ""}`.trim() || "Unknown",
        }));
    }

    async getCompanyPost(id: string): Promise<any | undefined> {
        const [post] = await db.select({
            id: companyPosts.id,
            tenantId: companyPosts.tenantId,
            authorId: companyPosts.authorId,
            authorFirstName: sql<string>`${employees.firstName}`,
            authorLastName: sql<string>`${employees.lastName}`,
            title: companyPosts.title,
            content: companyPosts.content,
            postType: companyPosts.postType,
            images: companyPosts.images,
            likesCount: companyPosts.likesCount,
            commentsCount: companyPosts.commentsCount,
            isPinned: companyPosts.isPinned,
            createdAt: companyPosts.createdAt,
        })
            .from(companyPosts)
            .leftJoin(employees, eq(companyPosts.authorId, employees.id))
            .where(eq(companyPosts.id, id));

        if (!post) return undefined;

        return {
            ...post,
            authorName: `${post.authorFirstName || ""} ${post.authorLastName || ""}`.trim() || "Unknown",
        };
    }

    async createCompanyPost(post: DbInsertCompanyPost): Promise<CompanyPost> {
        const [created] = await db.insert(companyPosts).values(post).returning();
        return created;
    }

    async updateCompanyPost(id: string, updates: Partial<DbInsertCompanyPost>): Promise<CompanyPost> {
        const [updated] = await db.update(companyPosts)
            .set(updates)
            .where(eq(companyPosts.id, id))
            .returning();
        if (!updated) throw new Error("Post not found");
        return updated;
    }

    async deleteCompanyPost(id: string): Promise<void> {
        await db.delete(companyPosts).where(eq(companyPosts.id, id));
    }

    async togglePostLike(tenantId: string, postId: string, employeeId: string, reactionType: string = 'like'): Promise<void> {
        const [existing] = await db.select()
            .from(postLikes)
            .where(and(
                eq(postLikes.tenantId, tenantId),
                eq(postLikes.postId, postId),
                eq(postLikes.employeeId, employeeId)
            ));

        if (existing) {
            if (existing.reactionType === reactionType) {
                // Remove if same reaction
                await db.delete(postLikes)
                    .where(eq(postLikes.id, existing.id));

                await db.update(companyPosts)
                    .set({ likesCount: sql`${companyPosts.likesCount} - 1` })
                    .where(eq(companyPosts.id, postId));
            } else {
                // Update if different reaction
                await db.update(postLikes)
                    .set({ reactionType })
                    .where(eq(postLikes.id, existing.id));
            }
        } else {
            // Create new
            await db.insert(postLikes).values({
                tenantId,
                postId,
                employeeId,
                reactionType
            });

            await db.update(companyPosts)
                .set({ likesCount: sql`${companyPosts.likesCount} + 1` })
                .where(eq(companyPosts.id, postId));

            // Award points for giving kudos (5 points)
            await this.awardPoints(tenantId, employeeId, 5, "Kudos өгсөн", "kudos", postId).catch(console.error);
        }
    }

    async getPostLikes(tenantId: string, postId: string): Promise<any[]> {
        return await db.select({
            id: postLikes.id,
            employeeId: postLikes.employeeId,
            employeeFirstName: sql<string>`${employees.firstName}`,
            employeeLastName: sql<string>`${employees.lastName}`,
            createdAt: postLikes.createdAt,
        })
            .from(postLikes)
            .leftJoin(employees, eq(postLikes.employeeId, employees.id))
            .where(and(eq(postLikes.tenantId, tenantId), eq(postLikes.postId, postId)))
            .orderBy(desc(postLikes.createdAt));
    }

    async createPostComment(comment: DbInsertPostComment): Promise<PostComment> {
        const [created] = await db.insert(postComments).values(comment).returning();

        // Update comments count
        const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, comment.postId));
        if (post) {
            await db.update(companyPosts)
                .set({ commentsCount: Number(post.commentsCount) + 1 })
                .where(eq(companyPosts.id, comment.postId));
        }

        return created;
    }

    async getPostComments(tenantId: string, postId: string): Promise<any[]> {
        // Join with employees to get names, and also join employees→users for a fallback
        return await db.select({
            id: postComments.id,
            tenantId: postComments.tenantId,
            postId: postComments.postId,
            employeeId: postComments.employeeId,
            employeeFirstName: sql<string>`${employees.firstName}`,
            employeeLastName: sql<string>`${employees.lastName}`,
            userFullName: sql<string>`${users.fullName}`,
            content: postComments.content,
            createdAt: postComments.createdAt,
        })
            .from(postComments)
            .leftJoin(employees, eq(postComments.employeeId, employees.id))
            .leftJoin(users, eq(employees.userId, users.id))
            .where(and(eq(postComments.tenantId, tenantId), eq(postComments.postId, postId)))
            .orderBy(asc(postComments.createdAt));
    }

    async deletePostComment(id: string): Promise<void> {
        // Get comment to update post count
        const [comment] = await db.select().from(postComments).where(eq(postComments.id, id));

        await db.delete(postComments).where(eq(postComments.id, id));

        // Update comments count
        if (comment) {
            const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, comment.postId));
            if (post) {
                await db.update(companyPosts)
                    .set({ commentsCount: Math.max(0, Number(post.commentsCount) - 1) })
                    .where(eq(companyPosts.id, comment.postId));
            }
        }
    }

    // --- Weather Widget ---
    async getWeatherSettings(tenantId: string): Promise<WeatherSettings | undefined> {
        const [settings] = await db.select()
            .from(weatherSettings)
            .where(eq(weatherSettings.tenantId, tenantId))
            .limit(1);
        return settings;
    }

    async upsertWeatherSettings(tenantId: string, settings: Partial<DbInsertWeatherSettings>): Promise<WeatherSettings> {
        const existing = await this.getWeatherSettings(tenantId);

        if (existing) {
            const [updated] = await db.update(weatherSettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(weatherSettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db.insert(weatherSettings)
                .values({
                    ...settings,
                    tenantId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as DbInsertWeatherSettings)
                .returning();
            return created;
        }
    }

    async getWeatherAlerts(tenantId: string, limit: number = 10): Promise<WeatherAlert[]> {
        return await db.select()
            .from(weatherAlerts)
            .where(eq(weatherAlerts.tenantId, tenantId))
            .orderBy(desc(weatherAlerts.createdAt))
            .limit(limit);
    }

    async createWeatherAlert(alert: DbInsertWeatherAlert): Promise<WeatherAlert> {
        const [created] = await db.insert(weatherAlerts).values(alert).returning();
        return created;
    }

    async markWeatherAlertAsSent(id: string): Promise<void> {
        await db.update(weatherAlerts)
            .set({ isSent: true, sentAt: new Date() })
            .where(eq(weatherAlerts.id, id));
    }

    // --- Documents ---
    async getDocuments(tenantId: string, parentId?: string | null, archived: boolean = false, scopingUserId?: string, readStatusUserId?: string): Promise<any[]> {
        const conditions = [
            eq(documents.tenantId, tenantId),
            eq(documents.isArchived, archived)
        ];

        if (parentId) {
            conditions.push(eq(documents.parentId, parentId));
        } else {
            conditions.push(isNull(documents.parentId));
        }

        // Base select with isRead subquery
        const isReadSubquery = readStatusUserId
            ? sql<boolean>`EXISTS(SELECT 1 FROM ${documentReads} WHERE ${documentReads.tenantId} = ${tenantId} AND ${documentReads.userId} = ${readStatusUserId} AND ${documentReads.documentId} = ${documents.id})`
            : sql<boolean>`false`;

        let query = db
            .select({
                ...getTableColumns(documents),
                isRead: isReadSubquery
            })
            .from(documents)
            .where(and(...conditions));

        // Employee scoping logic
        if (scopingUserId) {
            const [settings] = await db.select().from(companySettings).where(eq(companySettings.tenantId, tenantId));
            const policy = settings?.documentAccessPolicy || 'history';

            const accessConditions: any[] = [
                eq(documents.uploadedBy, scopingUserId),
                eq(documents.createdBy, scopingUserId),
                eq(documents.currentHolderId, scopingUserId)
            ];

            if (policy === 'history') {
                const participantDocIdsQuery = db
                    .select({ documentId: documentLogs.documentId })
                    .from(documentLogs)
                    .where(
                        or(
                            eq(documentLogs.fromUserId, scopingUserId),
                            eq(documentLogs.toUserId, scopingUserId)
                        )
                    );
                accessConditions.push(inArray(documents.id, participantDocIdsQuery));
            }

            query = db
                .select({
                    ...getTableColumns(documents),
                    isRead: isReadSubquery
                })
                .from(documents)
                .where(
                    and(
                        ...conditions,
                        or(...accessConditions)
                    )
                );
        }

        return await query.orderBy(desc(documents.type), asc(documents.name));
    }

    async getUnreadDocumentsCount(tenantId: string, userId: string): Promise<number> {
        // Unread documents are those where currentHolderId is me and no record in documentReads
        const unreadIncomingQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(documents)
            .where(
                and(
                    eq(documents.tenantId, tenantId),
                    eq(documents.currentHolderId, userId),
                    eq(documents.isArchived, false),
                    sql`NOT EXISTS(SELECT 1 FROM ${documentReads} WHERE ${documentReads.tenantId} = ${tenantId} AND ${documentReads.userId} = ${userId} AND ${documentReads.documentId} = ${documents.id})`
                )
            );

        const [result] = await unreadIncomingQuery;
        return Number(result?.count || 0);
    }

    async markDocumentAsRead(tenantId: string, userId: string, documentId: string): Promise<void> {
        // Idempotent upsert
        await db.insert(documentReads)
            .values({
                tenantId,
                userId,
                documentId,
                readAt: new Date()
            })
            .onConflictDoUpdate({
                target: [documentReads.tenantId, documentReads.userId, documentReads.documentId],
                set: { readAt: new Date() }
            });
    }

    async toggleDocumentArchive(id: string, isArchived: boolean): Promise<Document> {
        const [updated] = await db
            .update(documents)
            .set({ isArchived, updatedAt: new Date() })
            .where(eq(documents.id, id))
            .returning();
        return updated;
    }

    async getDocument(id: string): Promise<Document | undefined> {
        const [doc] = await db.select().from(documents).where(eq(documents.id, id));
        return doc;
    }

    async createDocument(doc: DbInsertDocument): Promise<Document> {
        const [d] = await db.insert(documents).values(doc).returning();
        return d;
    }

    async deleteDocument(id: string): Promise<void> {
        await db.delete(documents).where(eq(documents.id, id));
    }

    async signDocument(id: string, userId: string): Promise<Document> {
        const [signedDoc] = await db
            .update(documents)
            .set({
                isSigned: true,
                signedBy: userId,
                signedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(documents.id, id))
            .returning();

        if (!signedDoc) throw new Error("Document not found");
        return signedDoc;
    }

    async seedDocuments(tenantId: string, userId: string): Promise<void> {
        const existing = await db.select().from(documents).where(eq(documents.tenantId, tenantId)).limit(1);
        if (existing.length > 0) return;

        // Create System Generated folder
        const [systemFolder] = await db.insert(documents).values({
            tenantId,
            name: "System Generated",
            type: "folder",
            path: "/System Generated",
            uploadedBy: userId,
        } as any).returning();

        // Create Invoices folder
        const [invoicesFolder] = await db.insert(documents).values({
            tenantId,
            name: "Invoices",
            type: "folder",
            path: "/System Generated/Invoices",
            parentId: systemFolder.id,
            uploadedBy: userId,
        } as any).returning();

        // Create Mock Files
        const files = ["INV-2024-001.pdf", "INV-2024-002.pdf", "INV-2024-003.pdf"];
        for (const name of files) {
            await db.insert(documents).values({
                tenantId,
                name,
                type: "file",
                path: `/System Generated/Invoices/${name}`,
                parentId: invoicesFolder.id,
                mimeType: "application/pdf",
                size: Math.floor(Math.random() * 500000) + 100000,
                uploadedBy: userId,
            } as any);
        }
    }

    async ensureInvoiceFolder(tenantId: string, userId: string): Promise<string> {
        // 1. Check System Generated
        let [systemFolder] = await db.select().from(documents).where(and(eq(documents.tenantId, tenantId), eq(documents.name, "System Generated"), eq(documents.type, "folder")));

        if (!systemFolder) {
            [systemFolder] = await db.insert(documents).values({
                tenantId,
                name: "System Generated",
                type: "folder",
                path: "/System Generated",
                uploadedBy: userId,
            } as any).returning();
        }

        // 2. Check Invoices
        let [invoicesFolder] = await db.select().from(documents).where(and(eq(documents.tenantId, tenantId), eq(documents.name, "Invoices"), eq(documents.parentId, systemFolder.id)));

        if (!invoicesFolder) {
            [invoicesFolder] = await db.insert(documents).values({
                tenantId,
                name: "Invoices",
                type: "folder",
                path: "/System Generated/Invoices",
                parentId: systemFolder.id,
                uploadedBy: userId,
            } as any).returning();
        }

        return invoicesFolder.id;
    }

    async updateUserSignature(userId: string, updates: { signatureUrl?: string | null, signatureTitle?: string | null }): Promise<User> {
        const updateData: any = { updatedAt: new Date() };
        if (updates.signatureUrl !== undefined) {
            updateData.signatureUrl = updates.signatureUrl;
        }
        if (updates.signatureTitle !== undefined) {
            updateData.signatureTitle = updates.signatureTitle;
        }

        const [user] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning();
        return user;
    }

    async updateUserPermissions(userId: string, permissions: { canSignDocuments?: boolean; jobTitle?: string | null }): Promise<User> {
        const updateData: any = { updatedAt: new Date() };
        if (permissions.canSignDocuments !== undefined) {
            updateData.canSignDocuments = permissions.canSignDocuments;
        }
        if (permissions.jobTitle !== undefined) {
            updateData.jobTitle = permissions.jobTitle?.trim().slice(0, 80) || null;
        }
        const [user] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning();
        if (!user) throw new Error("User not found");
        return user;
    }

    async bulkDeleteDocuments(ids: string[]): Promise<void> {
        if (!ids.length) return;

        // 1. Check for non-empty folders
        const contents = await db.select().from(documents).where(inArray(documents.id, ids));

        for (const doc of contents) {
            if (doc.type === 'folder') {
                const [child] = await db.select({ id: documents.id }).from(documents).where(eq(documents.parentId, doc.id)).limit(1);
                if (child) {
                    throw new Error(`Хавтас хоосон биш байна: ${doc.name}`);
                }
            }
        }

        // 2. Proceed with delete if all checks pass
        await db.delete(documents).where(inArray(documents.id, ids));
    }

    async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
        const [doc] = await db
            .update(documents)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(documents.id, id))
            .returning();

        if (!doc) throw new Error("Document not found");
        return doc;
    }

    // --- Document Logs ---
    async createDocumentLog(insertLog: DbInsertDocumentLog): Promise<void> {
        await db.insert(documentLogs).values(insertLog);
    }

    async getDocumentLogs(documentId: string): Promise<DocumentLog[]> {
        const logs = await db
            .select()
            .from(documentLogs)
            .where(eq(documentLogs.documentId, documentId))
            .orderBy(desc(documentLogs.timestamp));
        return logs;
    }

    // ==========================================
    // Internal Communication - Announcements
    // ==========================================

    async getAnnouncements(tenantId: string, options?: { unreadOnly?: boolean, userId?: string }): Promise<any[]> {
        const userId = options?.userId || '00000000-0000-0000-0000-000000000000';

        const list = await db.query.announcements.findMany({
            where: eq(announcements.tenantId, tenantId),
            orderBy: [desc(announcements.isPinned), desc(announcements.createdAt)],
            with: {
                comments: {
                    columns: { id: true }
                },
                reactions: {
                    columns: { userId: true, emoji: true }
                },
                reads: {
                    columns: { userId: true }
                }
            }
        });

        return list.map(a => ({
            ...a,
            commentsCount: a.comments.length,
            likesCount: a.reactions.filter(r => r.emoji === '👍').length,
            isLiked: a.reactions.some(r => r.userId === userId && r.emoji === '👍'),
            isRead: a.reads.some(r => r.userId === userId)
        }));
    }

    async getAnnouncement(id: string): Promise<Announcement | undefined> {
        const [announcement] = await db
            .select()
            .from(announcements)
            .where(eq(announcements.id, id));
        return announcement;
    }

    async createAnnouncement(announcement: DbInsertAnnouncement): Promise<Announcement> {
        const [created] = await db
            .insert(announcements)
            .values(announcement)
            .returning();
        return created;
    }

    async updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement> {
        const [updated] = await db
            .update(announcements)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(announcements.id, id))
            .returning();
        if (!updated) throw new Error("Announcement not found");
        return updated;
    }

    async deleteAnnouncement(id: string): Promise<void> {
        await db.delete(announcements).where(eq(announcements.id, id));
    }

    async markAnnouncementAsRead(announcementId: string, userId: string): Promise<void> {
        await db
            .insert(announcementReads)
            .values({ announcementId, userId })
            .onConflictDoNothing();
    }

    async getAnnouncementComments(announcementId: string): Promise<any[]> {
        return await db
            .select({
                id: announcementComments.id,
                announcementId: announcementComments.announcementId,
                userId: announcementComments.userId,
                content: announcementComments.content,
                createdAt: announcementComments.createdAt,
                user: {
                    fullName: users.fullName,
                    email: users.email
                }
            })
            .from(announcementComments)
            .leftJoin(users, eq(announcementComments.userId, users.id))
            .where(eq(announcementComments.announcementId, announcementId))
            .orderBy(asc(announcementComments.createdAt));
    }

    async addAnnouncementComment(announcementId: string, userId: string, content: string): Promise<AnnouncementComment> {
        const [comment] = await db
            .insert(announcementComments)
            .values({ announcementId, userId, content })
            .returning();
        return comment;
    }

    async toggleAnnouncementReaction(announcementId: string, userId: string, emoji: string): Promise<{ added: boolean }> {
        const existing = await db
            .select()
            .from(announcementReactions)
            .where(and(
                eq(announcementReactions.announcementId, announcementId),
                eq(announcementReactions.userId, userId),
                eq(announcementReactions.emoji, emoji)
            ));

        if (existing.length > 0) {
            await db.delete(announcementReactions).where(eq(announcementReactions.id, existing[0].id));
            return { added: false };
        } else {
            await db.insert(announcementReactions).values({ announcementId, userId, emoji });
            return { added: true };
        }
    }

    async getAnnouncementReactions(announcementId: string): Promise<AnnouncementReaction[]> {
        return await db
            .select()
            .from(announcementReactions)
            .where(eq(announcementReactions.announcementId, announcementId));
    }

    // ==========================================
    // Internal Communication - Chat
    // ==========================================

    async getChatChannels(tenantId: string, userId: string): Promise<(ChatChannel & { unreadCount?: number })[]> {
        // Get all channels where user is a member
        const memberChannelIds = await db
            .select({ channelId: chatChannelMembers.channelId })
            .from(chatChannelMembers)
            .where(eq(chatChannelMembers.userId, userId));

        if (memberChannelIds.length === 0) return [];

        const channelIds = memberChannelIds.map(m => m.channelId);

        const result = await db
            .select({
                ...getTableColumns(chatChannels),
                unreadCount: sql<number>`(
          SELECT count(*)::int
          FROM ${chatMessages}
          WHERE ${chatMessages.channelId} = ${chatChannels.id}
          AND ${chatMessages.isDeleted} = false
          AND ${chatMessages.createdAt} > COALESCE((
            SELECT ${chatChannelMembers.lastReadAt}
            FROM ${chatChannelMembers}
            WHERE ${chatChannelMembers.channelId} = ${chatChannels.id}
            AND ${chatChannelMembers.userId} = ${userId}
          ), '1970-01-01')
        )`
            })
            .from(chatChannels)
            .where(and(
                eq(chatChannels.tenantId, tenantId),
                inArray(chatChannels.id, channelIds)
            ))
            .orderBy(desc(chatChannels.lastMessageAt));

        return result as (ChatChannel & { unreadCount?: number })[];
    }

    async getChatChannel(id: string): Promise<ChatChannel | undefined> {
        const [channel] = await db
            .select()
            .from(chatChannels)
            .where(eq(chatChannels.id, id));
        return channel;
    }

    async getOrCreateDirectChannel(tenantId: string, userIdA: string, userIdB: string, createdById: string): Promise<ChatChannel> {
        // Create unique key (sorted to ensure consistency)
        const ids = [userIdA, userIdB].sort();
        const uniqueKey = `${ids[0]}_${ids[1]}`;

        // Check if already exists
        const [existing] = await db
            .select()
            .from(chatChannels)
            .where(and(
                eq(chatChannels.tenantId, tenantId),
                eq(chatChannels.uniqueKey, uniqueKey)
            ));

        if (existing) return existing;

        // Create new direct channel
        const [newChannel] = await db
            .insert(chatChannels)
            .values({ tenantId, type: "direct", uniqueKey, createdById })
            .returning();

        // Add both users as members
        await db.insert(chatChannelMembers).values([
            { channelId: newChannel.id, userId: userIdA },
            { channelId: newChannel.id, userId: userIdB }
        ]);

        return newChannel;
    }

    async createGroupChannel(tenantId: string, name: string, createdById: string, memberIds: string[]): Promise<ChatChannel> {
        const [newChannel] = await db
            .insert(chatChannels)
            .values({ tenantId, type: "group", name, createdById })
            .returning();

        // Add creator as admin
        await db.insert(chatChannelMembers).values({ channelId: newChannel.id, userId: createdById, isAdmin: true });

        // Add other members
        for (const memberId of memberIds) {
            if (memberId !== createdById) {
                await db.insert(chatChannelMembers).values({ channelId: newChannel.id, userId: memberId });
            }
        }

        return newChannel;
    }

    async getChannelMembers(channelId: string): Promise<ChatChannelMember[]> {
        return await db
            .select()
            .from(chatChannelMembers)
            .where(eq(chatChannelMembers.channelId, channelId));
    }

    async isChannelMember(channelId: string, userId: string): Promise<boolean> {
        const [member] = await db
            .select()
            .from(chatChannelMembers)
            .where(and(
                eq(chatChannelMembers.channelId, channelId),
                eq(chatChannelMembers.userId, userId)
            ));
        return !!member;
    }

    async getChatMessages(channelId: string, limit: number = 50, cursor?: string): Promise<any[]> {
        const result = await db
            .select({
                id: chatMessages.id,
                channelId: chatMessages.channelId,
                senderId: chatMessages.senderId,
                content: chatMessages.content,
                type: chatMessages.type,
                fileUrl: chatMessages.fileUrl,
                replyToId: chatMessages.replyToId,
                isDeleted: chatMessages.isDeleted,
                createdAt: chatMessages.createdAt,
                senderName: users.fullName,
                senderEmail: users.email
            })
            .from(chatMessages)
            .leftJoin(users, eq(chatMessages.senderId, users.id))
            .where(and(
                eq(chatMessages.channelId, channelId),
                eq(chatMessages.isDeleted, false)
            ))
            .orderBy(desc(chatMessages.createdAt))
            .limit(limit);

        return result;
    }

    async updateMessage(messageId: string, senderId: string, newContent: string): Promise<{ success: boolean; error?: string }> {
        // Get message to verify ownership
        const [message] = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.id, messageId))
            .limit(1);

        if (!message) {
            return { success: false, error: "Message not found" };
        }

        if (message.senderId !== senderId) {
            return { success: false, error: "Зөвхөн өөрийн мессежийг засах боломжтой" };
        }

        await db
            .update(chatMessages)
            .set({
                content: newContent,
                // Could add editedAt timestamp if schema supports it
            })
            .where(eq(chatMessages.id, messageId));

        return { success: true };
    }

    async createChatMessage(message: DbInsertChatMessage): Promise<ChatMessage> {
        const [created] = await db
            .insert(chatMessages)
            .values({
                ...message,
                createdAt: new Date(),
            })
            .returning();

        // Update channel's lastMessageAt and preview
        await db
            .update(chatChannels)
            .set({
                lastMessageAt: new Date(),
                lastMessagePreview: created.content.substring(0, 100)
            })
            .where(eq(chatChannels.id, message.channelId));

        return created;
    }

    async updateLastReadAt(channelId: string, userId: string): Promise<void> {
        await db
            .update(chatChannelMembers)
            .set({ lastReadAt: new Date() })
            .where(and(
                eq(chatChannelMembers.channelId, channelId),
                eq(chatChannelMembers.userId, userId)
            ));
    }

    async getChatMessageById(messageId: string): Promise<ChatMessage | null> {
        const [message] = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.id, messageId))
            .limit(1);
        return message || null;
    }

    async deleteMessage(messageId: string): Promise<void> {
        // Soft delete
        await db
            .update(chatMessages)
            .set({ isDeleted: true })
            .where(eq(chatMessages.id, messageId));
    }

    async deleteChannel(channelId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        // Get channel
        const [channel] = await db
            .select()
            .from(chatChannels)
            .where(eq(chatChannels.id, channelId))
            .limit(1);

        if (!channel) {
            return { success: false, error: "Channel not found" };
        }

        // For direct chats, any member can delete
        // For group chats, only creator can delete
        if (channel.type === "group") {
            if (channel.createdById !== userId) {
                return { success: false, error: "Зөвхөн группийг үүсгэсэн хүн устгах боломжтой" };
            }
        } else {
            // Direct chat - check if user is a member
            const isMember = await this.isChannelMember(channelId, userId);
            if (!isMember) {
                return { success: false, error: "Энэ чатын гишүүн биш байна" };
            }
        }

        // Delete members first
        await db
            .delete(chatChannelMembers)
            .where(eq(chatChannelMembers.channelId, channelId));

        // Delete messages
        await db
            .delete(chatMessages)
            .where(eq(chatMessages.channelId, channelId));

        // Delete channel
        await db
            .delete(chatChannels)
            .where(eq(chatChannels.id, channelId));

        return { success: true };
    }

    async toggleMessageReaction(messageId: string, userId: string, emoji: string): Promise<{ added: boolean } | null> {
        const existing = await db
            .select()
            .from(chatMessageReactions)
            .where(and(
                eq(chatMessageReactions.messageId, messageId),
                eq(chatMessageReactions.userId, userId),
                eq(chatMessageReactions.emoji, emoji)
            ))
            .limit(1);

        if (existing.length > 0) {
            await db
                .delete(chatMessageReactions)
                .where(eq(chatMessageReactions.id, existing[0].id));
            return null;
        } else {
            const [reaction] = await db
                .insert(chatMessageReactions)
                .values({
                    messageId,
                    userId,
                    emoji
                })
                .returning();
            return { added: true };
        }
    }

    async canUserAccessDocument(tenantId: string, documentId: string, userId: string): Promise<boolean> {
        // Admins and HR have full access
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });
        if (user && (user.role === 'Admin' || user.role === 'HR')) return true;

        const doc = await this.getDocument(documentId);
        if (!doc || doc.tenantId !== tenantId) return false;

        // Managers have access to all documents in their tenant (simplified for now, or match logic)
        if (user && user.role === 'Manager') return true;

        // Employee logic: Check if creator, uploader, holder or participant
        if (doc.createdBy === userId || doc.uploadedBy === userId || doc.currentHolderId === userId) {
            return true;
        }

        // Check company policy
        const [settings] = await db.select().from(companySettings).where(eq(companySettings.tenantId, tenantId));
        const policy = settings?.documentAccessPolicy || 'history';

        if (policy === 'strict') {
            return false;
        }

        // Participant check (history mode)
        const logs = await db
            .select()
            .from(documentLogs)
            .where(
                and(
                    eq(documentLogs.documentId, documentId),
                    or(
                        eq(documentLogs.fromUserId, userId),
                        eq(documentLogs.toUserId, userId)
                    )
                )
            )
            .limit(1);

        return logs.length > 0;
    }
}
