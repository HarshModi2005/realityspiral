import fs from "node:fs/promises";
import {
	type Action,
	type Content,
	type HandlerCallback,
	type IAgentRuntime,
	type Memory,
	ModelClass,
	type Plugin,
	type State,
	elizaLogger,
	generateObject,
} from "@elizaos/core";
import {
	composeContext,
	traceResult,
} from "@realityspiral/plugin-instrumentation";
import { captureError } from "@realityspiral/sentry";
import { GitHubService } from "../services/github";
import {
	addCommentToPRTemplate,
	closePRActionTemplate,
	createCommitTemplate,
	createPullRequestTemplate,
	generateCodeFileChangesTemplate,
	generateCommentForASpecificPRTemplate,
	generatePRCommentReplyTemplate,
	implementFeatureTemplate,
	mergePRActionTemplate,
	reactToPRTemplate,
	replyToPRCommentTemplate,
} from "../templates";
import {
	type AddCommentToPRContent,
	AddCommentToPRSchema,
	type ClosePRActionContent,
	ClosePRActionSchema,
	CreateCommitContent,
	CreateCommitSchema,
	CreatePullRequestContent,
	CreatePullRequestSchema,
	type GenerateCodeFileChangesContent,
	GenerateCodeFileChangesSchema,
	GenerateCommentForASpecificPRSchema,
	type GeneratePRCommentReplyContent,
	GeneratePRCommentReplySchema,
	type ImplementFeatureContent,
	ImplementFeatureSchema,
	type MergePRActionContent,
	MergePRActionSchema,
	type ReactToPRContent,
	ReactToPRSchema,
	type ReplyToPRCommentContent,
	ReplyToPRCommentSchema,
	isAddCommentToPRContent,
	isClosePRActionContent,
	isCreateCommitContent,
	isCreatePullRequestContent,
	isGenerateCodeFileChangesContent,
	isGenerateCommentForASpecificPRSchema,
	isGeneratePRCommentReplyContent,
	isImplementFeatureContent,
	isMergePRActionContent,
	isReactToPRContent,
	isReplyToPRCommentContent,
} from "../types";
import { getPullRequestFromMemories, initRepo } from "../utils";
import { createCommitAction } from "./createCommit";
import { createIssueAction } from "./createIssue";
import { createPullRequestAction } from "./createPullRequest";
import { initializeRepositoryAction } from "./initializeRepository";

export const reactToPRAction: Action = {
	name: "REACT_TO_PR",
	similes: [
		"ADD_REACTION_PR",
		"REACT_TO_PR",
		"ADD_REACTION_PR",
		"POST_REACTION_PR",
	],
	description:
		"Adds a reaction to a comment in a pull request in the GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");

		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log("[reactToPR] Composing state for message:", message);

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: reactToPRTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: ReactToPRSchema,
		});

		if (!isReactToPRContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as ReactToPRContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		elizaLogger.info("Adding reaction to pull request comment...");

		try {
			const reaction =
				await githubService.createReactionForPullRequestReviewComment(
					content.owner,
					content.repo,
					content.pullRequest,
					content.reaction,
				);
			const pr = await githubService.getPullRequest(content.pullRequest);

			elizaLogger.info("Reaction:", JSON.stringify(reaction, null, 2));
			elizaLogger.info(
				`Added reaction to pull request #${content.pullRequest} successfully! PR: ${pr.html_url}`,
			);

			const response: Content = {
				text: `Added reaction to pull request #${content.pullRequest} successfully! PR: ${pr.html_url}`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error adding reaction to pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
				error,
			);
			if (callback) {
				callback(
					{
						text: `Error adding reaction to pull request #${content.pullRequest}. Please try again.`,
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "React to pull request #1 in repository user1/repo1 with a thumbs up",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added reaction to pull request #1 successfully!",
					action: "REACT_TO_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "React to pull request #2 in repository user2/repo2 with a heart (like showing love)",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added reaction to pull request #2 successfully! (like a charm)",
					action: "REACT_TO_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "React to pull request #3 in repository user3/repo3 with a laugh (like a burst of joy)",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added reaction to pull request #3 successfully! (like a breeze)",
					action: "REACT_TO_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "React to pull request #4 in repository user4/repo4 with a rocket (like shooting for the stars)",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added reaction to pull request #4 successfully! (like a rocket launch)",
					action: "REACT_TO_PR",
				},
			},
		],
	],
};

export const addCommentToPRAction: Action = {
	name: "COMMENT_ON_PULL_REQUEST",
	similes: [
		"COMMENT_ON_PR",
		"REVIEW_PR",
		"REVIEW_PULL_REQUEST",
		"ADD_REVIEW_COMMENT_TO_PR",
		"ADD_REVIEW_COMMENT_TO_PULL_REQUEST",
		"ADD_COMMENT_TO_PR",
		"ADD_COMMENT_TO_PULL_REQUEST",
		"POST_COMMENT_PR",
		"ADD_COMMENT_PR",
	],
	description:
		"Adds a comment and review to an existing pull request in the GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log(
		//     "[addCommentToPR] Composing state for message:",
		//     message
		// );

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state: state,
			template: addCommentToPRTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: AddCommentToPRSchema,
		});

		if (!isAddCommentToPRContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as AddCommentToPRContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		elizaLogger.info("Adding comment to pull request in the repository...");

		const pullRequest = await getPullRequestFromMemories(
			runtime,
			message,
			content.pullRequest,
		);
		const pr = await githubService.getPullRequest(content.pullRequest);
		const diffText = await githubService.getPRDiffText(pr.diff_url);

		if (!pullRequest) {
			elizaLogger.error("Pull request not found in memories");

			const prData = {
				type: "pull_request",
				url: pr.html_url,
				number: pr.number,
				state: pr.state,
				created_at: pr.created_at,
				updated_at: pr.updated_at,
				comments: await githubService.getPRCommentsText(pr.review_comment_url),
				nonReviewComments: await githubService.getPRCommentsText(
					pr.comments_url,
				),
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				labels: pr.labels.map((label: any) =>
					typeof label === "string" ? label : label?.name,
				),
				body: pr.body,
				diff: diffText,
				lineLevelComments: [],
			};

			state.specificPullRequest = JSON.stringify(prData);
		} else {
			state.specificPullRequest = JSON.stringify(pullRequest.content);
		}

		const commentContext = composeContext({
			state,
			template: generateCommentForASpecificPRTemplate,
		});

		const commentDetails = await generateObject({
			runtime,
			context: commentContext,
			modelClass: ModelClass.SMALL,
			schema: GenerateCommentForASpecificPRSchema,
		});

		if (!isGenerateCommentForASpecificPRSchema(commentDetails.object)) {
			elizaLogger.error("Invalid comment content:", commentDetails.object);
			throw new Error("Invalid comment content");
		}

		const comment = commentDetails.object;

		elizaLogger.info("Adding comment to pull request in the repository...", {
			pullRequest,
			comment,
			lineLevelComments: comment.lineLevelComments,
		});

		const sanitizedLineLevelComments = comment.lineLevelComments
			? await Promise.all(
					comment.lineLevelComments.map(async (lineLevelComment) => {
						return await githubService.addLineLevelComment(
							diffText,
							lineLevelComment.path,
							lineLevelComment.line || 0,
							lineLevelComment.body,
						);
					}),
				)
			: [];

		try {
			const addedComment = await githubService.addPRCommentAndReview(
				content.pullRequest,
				comment.comment,
				sanitizedLineLevelComments,
				comment.approvalEvent,
			);

			elizaLogger.info("Comment:", JSON.stringify(comment, null, 2));
			elizaLogger.info(
				`Added comment to pull request #${content.pullRequest} successfully! See comment at ${addedComment.html_url}. Approval status: ${comment.approvalEvent}`,
			);

			if (content.emojiReaction) {
				// TODO: add emoji reaction to pull request which this library doesn't support
				// await githubService.createReactionForPullRequestReviewComment(
				//     content.owner,
				//     content.repo,
				//     content.pullRequest,
				//     content.emojiReaction
				// );
				// elizaLogger.info(
				//     `Added emoji reaction to pull request #${content.pullRequest} successfully!`
				// );
			}

			const response: Content = {
				text: `Added comment to pull request #${content.pullRequest} successfully! See comment at ${addedComment.html_url}`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error adding comment to pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
				error,
			);

			if (callback) {
				callback(
					{
						text: `Error adding comment to pull request #${content.pullRequest}. Please try again.`,
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #1 in repository user1/repo1: 'This is fixed in the latest release'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #1 successfully!",
					action: "ADD_COMMENT_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #2 in repository user2/repo2: 'Please review the changes'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #2 successfully!",
					action: "ADD_COMMENT_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #3 in repository user3/repo3: 'Great work on this feature!'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #3 successfully!",
					action: "ADD_COMMENT_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #4 in repository user4/repo4: 'Can you add more tests?'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #4 successfully!",
					action: "ADD_COMMENT_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #5 in repository user5/repo5: 'This needs some refactoring'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #5 successfully!",
					action: "ADD_COMMENT_PR",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #6 in repository user6/repo6: 'Looks good to me', approve the changes",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment and approved pull request #6 successfully!",
					action: "COMMENT_ON_PULL_REQUEST",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #7 in repository user7/repo7: 'Needs more work', request changes",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment and requested changes for pull request #7 successfully!",
					action: "COMMENT_ON_PULL_REQUEST",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Add a comment to pull request #8 in repository user8/repo8: 'I have some questions', comment only",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Added comment to pull request #8 successfully!",
					action: "COMMENT_ON_PULL_REQUEST",
				},
			},
		],
	],
};

export const closePRAction: Action = {
	name: "CLOSE_PULL_REQUEST",
	similes: ["CLOSE_PR", "CLOSE_PULL_REQUEST"],
	description: "Closes a pull request in the GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log("[closePR] Composing state for message:", message);

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: closePRActionTemplate,
		});
		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: ClosePRActionSchema,
		});

		if (!isClosePRActionContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as ClosePRActionContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		elizaLogger.info("Closing pull request...");

		try {
			const pr = await githubService.updatePullRequest(
				content.owner,
				content.repo,
				content.pullRequest,
				undefined,
				undefined,
				"closed",
			);

			elizaLogger.info("Pull request:", JSON.stringify(pr, null, 2));
			elizaLogger.info(
				`Closed pull request #${content.pullRequest} successfully!`,
			);

			const response: Content = {
				text: `Closed pull request #${content.pullRequest} successfully!`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error closing pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
				error,
			);

			if (callback) {
				callback(
					{
						text: `Error closing pull request #${content.pullRequest}. Please try again.`,
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Close pull request #1 in repository user1/repo1",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Closed pull request #1 successfully!",
					action: "CLOSE_PR",
				},
			},
		],
	],
};

export const mergePRAction: Action = {
	name: "MERGE_PULL_REQUEST",
	similes: [
		"MERGE_PR",
		"SQUASH_PR",
		"SQUASH_PULL_REQUEST",
		"REBASE_PR",
		"REBASE_PULL_REQUEST",
		"MERGE_PULL_REQUEST",
	],
	description: "Merges a pull request in the GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log("[mergePR] Composing state for message:", message);
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: mergePRActionTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: MergePRActionSchema,
		});

		if (!isMergePRActionContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as MergePRActionContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		elizaLogger.info("Merging pull request...");

		try {
			const mergeResult = await githubService.mergePullRequest(
				content.owner,
				content.repo,
				content.pullRequest,
				content.mergeMethod,
			);

			elizaLogger.info("Merge result:", JSON.stringify(mergeResult, null, 2));
			elizaLogger.info(
				`Merged pull request #${content.pullRequest} successfully!`,
			);

			const response: Content = {
				text: `Merged pull request #${content.pullRequest} successfully!`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error merging pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
				error,
			);

			if (callback) {
				callback(
					{
						text: `Error merging pull request #${content.pullRequest}. Please try again.`,
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Merge pull request #1 in repository user1/repo1 using merge method 'squash'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Merged pull request #1 successfully!",
					action: "MERGE_PULL_REQUEST",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Merge pull request #2 in repository user2/repo2 using merge method 'merge'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Merged pull request #2 successfully!",
					action: "MERGE_PULL_REQUEST",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Merge pull request #3 in repository user3/repo3 using merge method 'rebase'",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Merged pull request #3 successfully!",
					action: "MERGE_PULL_REQUEST",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Merge pull request #4 in repository user4/repo4",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Merged pull request #4 successfully!",
					action: "MERGE_PULL_REQUEST",
				},
			},
		],
	],
};

export const replyToPRCommentAction: Action = {
	name: "REPLY_TO_PR_COMMENT",
	similes: ["REPLY_PR_COMMENT", "RESPOND_TO_PR_COMMENT", "ANSWER_PR_COMMENT"],
	description:
		"Replies to a specific comment in a pull request in the GitHub repository",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log(
		//     "[replyToPRComment] Composing state for message:",
		//     message
		// );

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: replyToPRCommentTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: ReplyToPRCommentSchema,
		});

		if (!isReplyToPRCommentContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as ReplyToPRCommentContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		// reply to all comments in the pull request
		const pullRequest = await githubService.getPullRequest(content.pullRequest);

		state.specificPullRequest = JSON.stringify(pullRequest);

		elizaLogger.info("Pull request:", JSON.stringify(pullRequest, null, 2));

		const reviewCommentsUrl = pullRequest.review_comments_url;

		elizaLogger.info("Review Comments URL:", reviewCommentsUrl);

		const reviewComments =
			await githubService.getPRCommentsText(reviewCommentsUrl);

		elizaLogger.info(
			"Review Comments:",
			JSON.stringify(reviewComments, null, 2),
		);

		const reviewCommentsArray = JSON.parse(reviewComments);
		const nonReviewComments = await githubService.getPRCommentsText(
			pullRequest.comments_url,
		);

		elizaLogger.info(
			"Non-Review Comments:",
			JSON.stringify(nonReviewComments, null, 2),
		);

		const nonReviewCommentsArray = JSON.parse(nonReviewComments);
		const allComments = [...reviewCommentsArray, ...nonReviewCommentsArray];
		for (const comment of allComments) {
			const replyContext = composeContext({
				state,
				template: generatePRCommentReplyTemplate,
			});
			const replyDetails = await generateObject({
				runtime,
				context: replyContext,
				modelClass: ModelClass.SMALL,
				schema: GeneratePRCommentReplySchema,
			});

			if (!isGeneratePRCommentReplyContent(replyDetails.object)) {
				elizaLogger.error("Invalid reply content:", replyDetails.object);
				throw new Error("Invalid reply content");
			}

			const replyContent = replyDetails.object as GeneratePRCommentReplyContent;

			if (replyContent.comment === "") {
				elizaLogger.info("No comment to reply to, skipping...");
				continue;
			}

			elizaLogger.info(
				"Replying to pull request comment...",
				JSON.stringify(replyContent, null, 2),
			);

			try {
				const repliedMessage = await githubService.replyToPRComment(
					content.pullRequest,
					comment.id,
					replyContent.comment,
					replyContent.emojiReaction,
				);

				elizaLogger.log(
					"Replied message:",
					JSON.stringify(repliedMessage, null, 2),
				);
				elizaLogger.info(
					`Replied to comment #${comment.id} in pull request #${content.pullRequest} successfully with emoji reaction: ${replyContent.emojiReaction}!`,
				);

				const response: Content = {
					text: `Replied to comment #${comment.id} in pull request #${content.pullRequest} successfully with emoji reaction: ${replyContent.emojiReaction}!`,
					attachments: [],
				};

				if (callback) {
					callback(response);
				}

				return traceResult(state, response);
			} catch (error) {
				elizaLogger.error(
					`Error replying to comment #${comment.id} in pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
					error,
				);

				if (callback) {
					callback(
						{
							text: `Error replying to comment #${comment.id} in pull request #${content.pullRequest}. Please try again.`,
						},
						[],
					);
				}
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Reply to all comments in pull request #1 in repository user1/repo1",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Replied to all comments in pull request #1 successfully!",
					action: "REPLY_TO_ALL_PR_COMMENTS",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Reply to all comments in pull request #2 in repository user2/repo2",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Replied to all comments in pull request #2 successfully!",
					action: "REPLY_TO_ALL_PR_COMMENTS",
				},
			},
		],
	],
};

export const generateCodeFileChangesAction: Action = {
	name: "GENERATE_CODE_FILE_CHANGES",
	similes: [
		"GENERATE_CODE_FILE_CHANGES",
		"GENERATE_CODE_CHANGES",
		"GENERATE_FILE_CHANGES",
	],
	description:
		"Generates code file changes based on feature requirements or issue details",
	validate: async (_runtime: IAgentRuntime) => {
		return true; // No specific validation needed
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		_options?: any,
		callback?: HandlerCallback,
	) => {
		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: generateCodeFileChangesTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: GenerateCodeFileChangesSchema,
		});

		if (!isGenerateCodeFileChangesContent(details.object)) {
			elizaLogger.error("Invalid code file changes content:", details.object);
			throw new Error("Invalid code file changes content");
		}

		const content = details.object as GenerateCodeFileChangesContent;

		// write file
		await fs.writeFile(
			"/tmp/generated-code-file-changes.json",
			JSON.stringify(content, null, 2),
		);

		const response: Content = {
			text: "Generated code file changes successfully!",
			action: "GENERATE_CODE_FILE_CHANGES",
			attachments: [],
		};

		if (callback) {
			await callback(response);
		}

		traceResult(state, response);

		return content;
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Generate code changes for replacing console.log with elizaLogger.log",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Generated code file changes successfully!",
					action: "GENERATE_CODE_FILE_CHANGES",
				},
			},
		],
	],
};

export const implementFeatureAction: Action = {
	name: "IMPLEMENT_FEATURE",
	similes: ["IMPLEMENT_FEATURE", "REPLACE_LOGS"],
	description:
		"Creates an issue, commits changes, and creates a pull request for a specified feature.",
	validate: async (runtime: IAgentRuntime) => {
		const token = !!runtime.getSetting("GITHUB_API_TOKEN");
		return token;
	},
	handler: async (
		runtime: IAgentRuntime,
		message: Memory,
		state?: State,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		options?: any,
		callback?: HandlerCallback,
	) => {
		// elizaLogger.log(
		//     "[implementFeature] Composing state for message:",
		//     message
		// );

		if (!state) {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = (await runtime.composeState(message)) as State;
		} else {
			// biome-ignore lint/style/noParameterAssign: <explanation>
			state = await runtime.updateRecentMessageState(state);
		}

		const context = composeContext({
			state,
			template: implementFeatureTemplate,
		});

		const details = await generateObject({
			runtime,
			context,
			modelClass: ModelClass.SMALL,
			schema: ImplementFeatureSchema,
		});

		if (!isImplementFeatureContent(details.object)) {
			elizaLogger.error("Invalid content:", details.object);
			throw new Error("Invalid content");
		}

		const content = details.object as ImplementFeatureContent;

		const githubService = new GitHubService({
			owner: content.owner,
			repo: content.repo,
			auth: runtime.getSetting("GITHUB_API_TOKEN") || "",
		});

		try {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			let issue: any;

			if (content.issue !== null) {
				elizaLogger.info(
					`Getting issue ${content.issue} from repository ${content.owner}/${content.repo}`,
				);

				issue = await githubService.getIssue(content.issue);
			} else {
				message.content.text = `Create an issue for ${content.feature} in repository ${content.owner}/${content.repo}`;

				issue = await createIssueAction.handler(
					runtime,
					message,
					state,
					options,
					callback,
				);

				elizaLogger.info("Created issue successfully!");
			}

			state.specificIssue = JSON.stringify(issue, null, 2);
			// Use generateCodeFileChangesAction
			message.content.text = `Generate code changes for ${content.feature}`;

			const codeFileChangesContent =
				(await generateCodeFileChangesAction.handler(
					runtime,
					message,
					state,
					options,
				)) as GenerateCodeFileChangesContent;

			state.codeFileChanges = codeFileChangesContent.files;

			// write file
			await fs.writeFile(
				"/tmp/implement-feature-code-file-changes.json",
				JSON.stringify(codeFileChangesContent, null, 2),
			);

			// Initialize repository
			await initRepo(
				runtime.getSetting("GITHUB_API_TOKEN") || "",
				content.owner,
				content.repo,
				content.base || "main",
			);

			message.content.text = `Commit changes to the repository ${content.owner}/${content.repo} on branch '${content.branch}' with the commit message: ${content.feature}`;

			// Commit changes
			const commit = await createCommitAction.handler(
				runtime,
				message,
				state,
				options,
			);
			state.specificCommit = commit;

			elizaLogger.info(
				"Committed changes successfully!",
				JSON.stringify(commit, null, 2),
			);

			message.content.text = `Create a pull request on repository ${content.owner}/${content.repo} with branch '${content.branch}', title '${content.feature}' against base '${content.base}' and files ${JSON.stringify([])}`;

			// Create pull request
			const pullRequest = await createPullRequestAction.handler(
				runtime,
				message,
				state,
				options,
			);

			elizaLogger.info(
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				`Pull request created successfully! ${(pullRequest as any).html_url}`,
			);

			const response: Content = {
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				text: `Pull request created successfully! ${(pullRequest as any).html_url}`,
				attachments: [],
			};

			if (callback) {
				callback(response);
			}

			return traceResult(state, response);
		} catch (error) {
			elizaLogger.error(
				`Error implementing feature in repository ${content.owner}/${content.repo} on branch ${content.branch}:`,
				error,
			);

			if (callback) {
				callback(
					{
						text: `Error implementing feature in repository ${content.owner}/${content.repo}. Please try again.`,
					},
					[],
				);
			}
		}
	},
	examples: [
		[
			{
				user: "{{user}}",
				content: {
					text: "Implement replacing console.log with elizaLogger.log across the repo on repository elizaOS/eliza branch realitySpiral/demo against base main",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pull request created successfully! URL: https://github.com/elizaOS/eliza/pull/1",
					action: "IMPLEMENT_FEATURE",
				},
			},
		],
		[
			{
				user: "{{user}}",
				content: {
					text: "Implement feature for issue #42 in repository elizaOS/eliza branch develop against base main",
				},
			},
			{
				user: "{{agentName}}",
				content: {
					text: "Pull request created successfully! URL: https://github.com/elizaOS/eliza/pull/2",
					action: "IMPLEMENT_FEATURE",
				},
			},
		],
	],
};

export const githubInteractWithPRPlugin: Plugin = {
	name: "githubInteractWithPR",
	description:
		"Integration with GitHub for adding comments or reactions or merging, or closing pull requests",
	actions: [
		addCommentToPRAction,
		reactToPRAction,
		closePRAction,
		mergePRAction,
		replyToPRCommentAction,
		generateCodeFileChangesAction,
		// implementFeatureAction,
	],
};
