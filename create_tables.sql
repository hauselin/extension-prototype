CREATE DATABASE ChromeData;

USE ChromeData;

CREATE TABLE UserProfile (
	pid VARCHAR(65535),
	)

--engagetype: un/trust, un/repost...
CREATE TABLE TweetsEngage (
	pid VARCHAR(65535),
	userid VARCHAR(65535),
	time_utc VARCHAR(65535),
	tweetid VARCHAR(65535),
	engagetype VARCHAR(65535),
	)

--save more tweet metadata
CREATE TABLE TweetsExpose (
	pid VARCHAR(65535),
	userid VARCHAR(65535),
	time_utc VARCHAR(65535),
	tweetid VARCHAR(65535),
	tweettype VARCHAR(65535),
	tweettext VARCHAR(65535),
	)

--save more tweet metadata
CREATE TABLE TweetsRead (
	pid VARCHAR(65535),
	userid VARCHAR(65535),
	time_utc VARCHAR(65535),
	tweetid VARCHAR(65535),
	tweettype VARCHAR(65535),
	tweettext VARCHAR(65535),
	)

CREATE TABLE TweetsDwell (
	pid VARCHAR(65535),
	userid VARCHAR(65535),
	time_utc VARCHAR(65535),
	tweetid VARCHAR(65535),
	inview_time VARCHAR(65535),
	dwell INT,
	)
