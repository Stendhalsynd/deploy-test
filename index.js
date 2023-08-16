const express = require("express");
const { WebClient } = require("@slack/web-api");
const schedule = require("node-schedule");

const app = express();
const port = process.env.PORT || 3000;

const slackToken = process.env.SLACK_TOKEN; // Replace with your Slack token
const channelId = process.env.CHANEL_ID;
const members = ["김종현", "장창현", "주상후", "홍지훈", "황동준"];
const web = new WebClient(slackToken);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

function getWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(days / 7) - 30;
  return weekNumber;
}

// Slack 사용자 정보를 가져오는 함수
async function getUserInfo(userId) {
  try {
    const userInfo = await web.users.info({
      user: userId,
    });
    return userInfo.user.profile.real_name;
  } catch (error) {
    console.error("오류:", error);
    return null;
  }
}

async function leaveComment(messageTs, memberNames) {
  try {
    // 멤버 이름 배열을 쉼표로 연결하여 메시지를 생성합니다.
    const membersText = memberNames.join(", ");
    const commentMessage = `${membersText} 님 시간이 초과되었습니다.`;

    // 댓글을 남깁니다.
    await web.chat.postMessage({
      channel: channelId,
      text: commentMessage,
      thread_ts: messageTs, // 원래 메시지에 대한 스레드에 댓글을 남깁니다.
    });
  } catch (error) {
    console.error("오류:", error);
  }
}

// Monitor the channel for messages and add reminders
async function monitorChannelAndAddReminders() {
  try {
    const channelHistory = await web.conversations.history({
      channel: channelId, // Replace with the channel ID
      count: 1, // Number of messages to fetch
    });

    const messages = channelHistory.messages;

    const week = getWeekNumber();
    for (const message of messages) {
      // console.log("message1 : ", message.text);
      if (message.text.includes(`${week}주차 React 학습`)) {
        console.log("실행");
        const threadReplies = await web.conversations.replies({
          channel: channelId,
          ts: message.ts,
        });

        const reminderMessage = `리마인더: ${week} 주차 React 블로깅을 잊지 마세요!`;

        // Post a reminder as a reply to the message
        await web.chat.postMessage({
          channel: channelId, // Replace with the channel ID
          text: reminderMessage,
          thread_ts: message.ts, // Reply to the specific thread
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Monitor the channel for messages and add reminders
async function monitorChannelAndAddRemindersOver() {
  try {
    const channelHistory = await web.conversations.history({
      channel: channelId, // Replace with the channel ID
      count: 1, // Number of messages to fetch
    });

    const messages = channelHistory.messages;

    const week = getWeekNumber();

    for (const message of messages) {
      // console.log("message1 : ", message.text);
      if (message.text.includes(`${week}주차 React 학습`)) {
        console.log("실행");
        const threadReplies = await web.conversations.replies({
          channel: channelId,
          ts: message.ts,
        });
        // 댓글 작성자들의 Slack 프로필 이름을 추출합니다.
        const commentAuthors = await Promise.all(
          threadReplies.messages.map(async (reply) => {
            const commenterName = await getUserInfo(reply.user);
            return commenterName || reply.user; // 프로필 이름이 없는 경우에는 사용자 ID를 반환합니다.
          })
        );

        // 댓글 작성 횟수가 2번 미만인 멤버를 찾습니다.
        const lessThanTwoComments = members.filter((member) => {
          const commentCount = commentAuthors.filter(
            (author) => author === member
          ).length;
          return commentCount < 2;
        });

        // 댓글을 남길 멤버의 이름을 전달하여 댓글을 남깁니다.
        await leaveComment(message.ts, lessThanTwoComments);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// 테스트용
// schedule.scheduleJob({ hour: 22, minute: 1 }, () => {
//   monitorChannelAndAddRemindersOver();
// });

// 토요일 오전 10시에 리마인더
schedule.scheduleJob({ dayOfWeek: 6, hour: 10, minute: 0 }, () => {
  monitorChannelAndAddReminders();
});

// 일요일 오후 11시 59분에 초과 메세지
schedule.scheduleJob({ dayOfWeek: 0, hour: 23, minute: 59 }, () => {
  monitorChannelAndAddRemindersOver();
});
