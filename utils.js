let retweetId;
let pid;

const getPageUrl = () => {
	return window.location.href.toLowerCase().split("?")[0];
}

const generateRandomString = (length) => {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * charset.length);
		result += charset.charAt(randomIndex);
	}
	return result;
}


const generatePID = () => {
	chrome.storage.sync.get(pid, function (result) {
		if (!result.pid) {
			pid = Date.now() + "_" + generateRandomString(5);
			chrome.storage.sync.set({ pid: pid });
			pid = result.pid;
		}
		pid = result.pid;
		console.log("pid:", pid);
	});
}

const getPageType = () => {
	const currentUrl = getPageUrl();
	let pageType;
	let username = getUsername();
	if (currentUrl.includes("/home")) {
		pageType = "home";
	} else if (currentUrl.includes("/explore")) {
		pageType = "explore";
	} else if (currentUrl.includes("/notifications")) {
		pageType = "notifications";
	} else if (currentUrl.includes("/messages")) {
		pageType = "messages";
	} else if (currentUrl.includes("/bookmarks")) {
		pageType = "bookmarks";
	} else if (currentUrl.includes("/lists")) {
		pageType = "lists";
	} else if (currentUrl.includes("/profile")) {
		pageType = "profile";
	} else if (currentUrl.includes("/" + username)) {
		pageType = "profile";
	} else if (currentUrl.includes("/status/")) {
		const pattern = /^https:\/\/twitter\.com\/[^\/]+\/status\/[^\/]+$/;
		if (pattern.test(currentUrl)) {
			pageType = "singletweet";
		}
	}
	return pageType;
}

const checkArticleLoadStatus = (query = "article[role=article]") => {
	return Boolean(document.querySelector(query));
}

const getLoadedArticles = (debug) => {
	const tweetsInDom = document.querySelectorAll("article[role=article]")
	if (debug) {
		console.log(`DEBUG: ${tweetsInDom.length} new tweets currently loaded`);
	}
	return tweetsInDom;
}
tweet = getLoadedArticles(false)[0];

const createTweetObj = (article) => {
	let tweetObj = { "repostuser": "", "timeUTC": new Date().toISOString() };
	let tweetIdUrl = getTweetIdUrl(article);
	tweetObj.username = getUsername();
	tweetObj.userid = getUseridFromCookie();
	tweetObj.tweetuser = tweetIdUrl.tweetuser;
	tweetObj.tweetid = tweetIdUrl.tweetid;
	tweetObj.tweeturl = tweetIdUrl.tweeturl;
	tweetObj.tweettext = getTweetText(article);
	tweetObj.repost = isRepost(article);
	tweetObj.metrics = getTweetMetrics(article);
	if (tweetObj.repost) {
		tweetObj.repostuser = getRepostUser(article);
	}
	tweetObj.promoted = isPromoted(article);
	return tweetObj;
}

const attributeStatus = (article, attribute = "data-buttonadded") => {
	return Boolean(article.getAttribute(attribute));
}

const getCookie = (name) => {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) {
		return parts.pop().split(';').shift();
	}
}

const getUsername = () => {
	let userURL = document.querySelector('a[aria-label="Profile"]')?.href;
	let username = "";
	if (userURL) {
		const arr = userURL.split("/");
		username = arr[arr.length - 1];
	}
	return username.toLowerCase();
}

const getUseridFromCookie = () => {
	let userid = getCookie("twid");
	if (!userid) {
		return "";
	}
	if (userid.startsWith("u%3D")) {
		userid = userid.substring(4);
	}
	return userid;
}

const getVisibleElements = (selector) => {
	let elements = document.querySelectorAll(selector);
	let windowHeight = window.innerHeight;
	let visibleElements = [];
	for (let i = 0; i < elements.length; i++) {
		let element = elements[i];
		let rect = element.getBoundingClientRect();
		if (rect.top < windowHeight && rect.bottom >= 0) {
			visibleElements.push(element);
		}
	}
	return visibleElements;
}

const fullyInView = (element) => {
	const rect = element.getBoundingClientRect();

	// Check if the element's top, bottom, left, and right are inside the viewport
	const isInHorizontalView = (rect.left >= 0) && (rect.right <= window.innerWidth);
	const isInVerticalView = (rect.top >= 0) && (rect.bottom <= window.innerHeight);

	return isInHorizontalView && isInVerticalView;
}

const getFullyVisibleTweets = (selector = "article[role=article]") => {
	let visibleElements = getVisibleElements(selector);
	const timeStr = new Date().toISOString();
	let visibleTweets = {};
	visibleElements.forEach((element) => {
		let tweetIdUrl = getTweetIdUrl(element);
		if (fullyInView(element) && tweetIdUrl.tweetid) {
			let tweetObj = createTweetObj(element);
			tweetObj['inviewTime'] = timeStr;
			tweetObj.el = element;
			visibleTweets[tweetIdUrl.tweetid] = tweetObj;
		}
	})
	return visibleTweets;
}

const objDifference = (obj1, obj2) => {
	const result = {};
	for (let key in obj1) {
		if (!(key in obj2)) {
			result[key] = obj1[key];
		}
	}
	return result;
}

const objLength = (obj) => {
	return Object.keys(obj).length;
}

const differenceInMilliseconds = (dateStr1, dateStr2) => {
	const date1 = new Date(dateStr1);
	const date2 = new Date(dateStr2);
	return date1 - date2;
}

const computeDwell = (tweets) => {
	const timeStr = new Date().toISOString();
	let dwellTimes = [];
	for (let key in tweets) {
		let tweet = {};
		tweet["pid"] = pid;
		tweet["userid"] = getUseridFromCookie();
		tweet["time_utc"] = timeStr;
		tweet["tweetid"] = key;
		tweet["inviewTime"] = tweets[key].inviewTime;
		tweet["dwell"] = differenceInMilliseconds(timeStr, tweets[key].inviewTime);
		dwellTimes.push(tweet);
	}
	return dwellTimes;
}

const getTweetIdUrl = (tweet) => {
	let obj = { tweeturl: "", tweetid: "", tweetuser: "" };
	let fullTweetUrl = tweet.querySelector('a[href*="/status/"]')?.href;
	// if the tweet URL does not contain an ID, attempt to find an alternative URL
	if (!fullTweetUrl || !fullTweetUrl.includes("/status/")) {
		let temp_link = tweet.querySelector('a.r-3s2u2q[role=link]');
		if (temp_link) {
			fullTweetUrl = `${temp_link.href}`;
		}
	}
	if (fullTweetUrl?.includes("/status/")) {
		obj.tweeturl = fullTweetUrl;
		obj.tweetid = fullTweetUrl.match(/\/status\/(.*)/i)[1].split("/")[0];
		obj.tweetuser = fullTweetUrl.split("/")[3].toLowerCase();

	}
	return obj;
}


const isRepost = (tweet) => {
	let repostSpan = tweet.querySelectorAll('span[data-testid="socialContext"]');
	let repostIcon = tweet.querySelectorAll('path[d="M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V8.38L1.853 9.91.147 8.09l4.603-4.3zm11.5 2.71H11V4h5.25c2.347 0 4.25 1.9 4.25 4.25v7.37l1.647-1.53 1.706 1.82-4.603 4.3-4.603-4.3 1.706-1.82L18 15.62V8.25c0-.97-.784-1.75-1.75-1.75z"]');
	if (repostSpan.length > 0 && repostIcon.length > 0) {
		return 1;
	}
	return 0;
}

const getRepostUser = (tweet) => {
	let repostUser = "";
	if (isRepost(tweet)) {
		let repostSpan = tweet.querySelectorAll('span[data-testid="socialContext"]');
		// parent element is the a tag
		repostUser = repostSpan[0]?.parentElement.href.split("/")[3].toLowerCase().trim()
	}
	return repostUser;
}

const isPromoted = (tweet) => {
	let spans = tweet.querySelectorAll("span");
	let promoted = 0;
	if (spans.length > 0) {
		spans.forEach((span) => {
			if (span.innerText === "Ad") {
				promoted = 1;
				return promoted
			}
		})
	}
	return promoted;
}

const getRetweetDropdownMenu = () => {
	return document.querySelector('div[data-testid="Dropdown"]');
}

const addRetweetDropdownListener = (dropdown, tweetId) => {
	if (dropdown) {
		const clickTime = new Date().toISOString();
		const userid = getUseridFromCookie();
		let elements = dropdown.childNodes;
		if (!elements[0].getAttribute("data-listeneradded")) {
			elements.forEach((el) => {
				el.setAttribute("data-listeneradded", "1");
			})

			let element = dropdown.querySelector("div[role=menuitem]");
			if (element) {
				let engageType = element.getAttribute("data-testid");
				element.addEventListener("click", () => {
					postButtonEngage(pid, userid, clickTime, tweetId, engageType);
				})
			}

			element = dropdown.querySelector("a[role=menuitem]");
			if (element) {
				element.addEventListener("click", () => {
					postButtonEngage(pid, userid, clickTime, tweetId, "composeQuote");
				})

			}

			element = dropdown.querySelector("a[role=link]");
			if (element) {
				element.addEventListener("click", () => {
					postButtonEngage(pid, userid, clickTime, tweetId, element.href);
				})

			}
		}
	}
}


const isQuoteTweet = (tweet) => { }

const isReply = (tweet) => { }

// TODO: need more testing
const getTweetText = (tweet, encode = true) => {
	let textDiv = tweet.querySelector('div[data-testid="tweetText"]');
	let txt = "";

	if (textDiv?.childNodes) {
		textDiv.childNodes.forEach((el) => {
			if (el.tagName == "IMG") {
				txt += el.alt + " ";
			}
			if (el.tagName == "SPAN") {
				txt += el.innerText + " ";
			}
			if (el.tagName == "A") {
				txt += el.href + " ";
				txt += el.innerText + " ";
			}

			// get a tags nested inside div
			if (el.tagName == "DIV") {
				txt += el.innerText + " ";
				if (el.childNodes.length > 0) {
					txt += " ";
					el.childNodes.forEach((child) => {
						if (child.tagName == "SPAN" && child.childNodes.length > 0) {
							child.childNodes.forEach((child2) => {
								if (child2.tagName == "A") {
									txt += child2.href + " ";
								}
							}
							)
						}
					})
				}
			}

		})
	}
	txt = txt.replace(/\n/g, " ");
	txt = txt.replaceAll("  ", " ");
	return txt;
}

const getTweetMedia = (tweet) => {
	tweet.querySelectorAll('div[data-testid]')
}

//NOTE: contains data-testid="card.layoutLarge.media"
//NOTE: contains data-testid="card.wrapper"
//NOTE: contains role="link"

const getTweetCreationDate = (tweet) => {
	// not available for promoted tweets
	let timeobj = tweet.querySelector('time[datetime]');
	let createDT = "";
	if (timeobj) {
		createDT = timeobj.getAttribute("datetime");
	}
	if (!createDT) {
		createDT = "";
	}
	return createDT;
}

const getTweetMetrics = (tweet) => {
	let pageType = getPageType();
	let metricsNode = tweet.querySelector('div[role=group]');
	if (!metricsNode) {
		return "";
	}
	else if (pageType == "home") {
		return encodeURIComponent(metricsNode.getAttribute("aria-label"));
	}
	else if (pageType == "singletweet") {
		return encodeURIComponent(metricsNode.innerText.replace(/\n/g, " ").replaceAll("  ", " "));
	}
}

// API endpoints 
const postButtonEngage = async (pid, userid, timeUTC, tweetid, engageType) => {
	console.error("POST TweetsEngage", pid, userid, timeUTC, tweetid, engageType);
}


const postArticleEngage = async (pid, userid, timeUTC, tweetid) => {
	console.error("POST TweetsRead", pid, userid, timeUTC, tweetid);
}

const addArticleListener = (tweet) => {
	tweet.setAttribute("data-articleclicklisten", "1");
	tweet.addEventListener("click", (event) => {
		if (!event.childClicked && getPageType() != "singletweet") {
			const clickTime = new Date().toISOString();
			const userid = getUseridFromCookie();
			const tweetIdUrl = getTweetIdUrl(tweet);
			postButtonEngage(pid, userid, clickTime, tweetIdUrl["tweetid"], "expand");
		}
	});
}

const obj2Array = (obj) => {
	let arr = [];
	for (let key in obj) {
		arr.push(obj[key]);
	}
	return arr;
}


const postTweetsExpose = async (pid, userid, timeUTC, tweets) => {
	const tweetsArray = obj2Array(tweets);
	// TODO: remove .el from each tweet (or select only required fields before posting)
	console.error(`POST ${tweetsArray.length} TweetsExpose`, pid, userid, timeUTC, tweetsArray);
}

const postTweetRead = async (pid, userid, timeUTC, tweetid) => {
	console.error("POST TweetsRead", pid, userid, timeUTC, tweetid);
}

const postUserDemographic = async (pid, userid, timeUTC) => {
}

const postDwell = async (pid, userid, timeUTC, tweets) => {
	console.error(`POST ${tweets.length} TweetsDwell`, pid, userid, timeUTC, tweets);
}


const getEngagementElements = () => {
	let engagementElements = [];
	let attribute;
	// TODO: if twitter changes retweet to repost, will have to change it here!
	document.querySelectorAll("div[role=button]").forEach((button) => {
		attribute = button.getAttribute("aria-label");
		if (attribute?.includes("Reply")) {
			engagementElements.push({ "type": "reply", "el": button });
		} else if (attribute?.includes("Retweet")) {
			engagementElements.push({ "type": "retweet", "el": button });
		} else if (attribute?.includes("Like")) {
			engagementElements.push({ "type": "like", "el": button });
		} else if (attribute?.includes("View")) {
			engagementElements.push({ "type": "view", "el": button });
		} else if (attribute?.includes("Share Tweet")) {
			engagementElements.push({ "type": "share", "el": button });
		} else if (attribute?.includes("Bookmark")) {
			engagementElements.push({ "type": "bookmark", "el": button });
		}
	});

	// get view button
	document.querySelectorAll("a[aria-label*=View]").forEach((button) => {
		attribute = button.getAttribute("aria-label");
		if (attribute?.includes("View")) {
			engagementElements.push({ "type": "view", "el": button });
		}
	})

	// get buttons we added
	document.querySelectorAll("button[content]").forEach((button) => {
		let engageType = button.getAttribute("content").toLowerCase();
		engagementElements.push({ "type": engageType, "el": button });
	})

	return engagementElements;
}


const addEngagementListeners = () => {
	let engagementElements = getEngagementElements();
	engagementElements.forEach((button) => {
		let { el } = button;
		let isClicked = true;
		let engageType;

		// retrieve closest ancestor
		const tweetIdUrl = getTweetIdUrl(el.closest("article[role='article']"));
		const tweetId = tweetIdUrl["tweetid"];

		if (el.getAttribute("data-buttonclicklisten") !== "1") {
			el.setAttribute("data-buttonclicklisten", "1")

			el.addEventListener("click", (event) => {
				// prevent parent element listener from firing when this element is clicked
				event.childClicked = true;
				const clickTime = new Date().toISOString();
				const userid = getUseridFromCookie();
				engageType = button.type;
				isClicked = !isClicked;

				if (button.type === "retweet" || button.type === "like" || button.type === "trust" || button.type == "bookmark") {
					engageType = el.getAttribute("data-testid");
					if (engageType == "removeBookmark") {
						engageType = "unbookmark";
					}
				}
				if (button.type === "retweet") {
					retweetId = tweetId;  // update global retweetId variable
				}
				postButtonEngage(pid, userid, clickTime, tweetId, engageType);

			});
		}
	});
}





// TODO: check if it works for individual tweets page and other pages
const addButton = (buttonLabel) => {

	//select all tweets that do not already have a trust button added and process them
	let tweetsWithoutButton = document.querySelectorAll(`article[role='article']:not([data-buttonadded='1'])`);
	let pageType = getPageType();
	tweetsWithoutButton.forEach((tweet) => {
		let metricsNode;
		let btnFontsize;
		let tooltipFontsize
		if (pageType == "singletweet") {
			metricsNode = tweet.querySelectorAll('.css-1dbjc4n[role=group]')[1];
			btnFontsize = "1.3em";
			tooltipFontsize = "0.75em";

		}
		if (!metricsNode) {
			metricsNode = tweet.querySelector('.css-1dbjc4n[role=group]');
			btnFontsize = "1.1em";
			tooltipFontsize = "0.7em";
		}

		if (metricsNode) {
			// create extra button
			let btn = document.createElement("button");
			btn.setAttribute("content", buttonLabel);
			btn.setAttribute("data-testid", buttonLabel);
			btn.setAttribute("style", `background-color: transparent; border: none; cursor: pointer; padding: 0; transition: transform 0.2s ease; color: gray; font-weight: bold; font-size: ${btnFontsize};`);
			btn.textContent = "\u2713";

			let tooltip = document.createElement("div");
			tooltip.setAttribute("content", "newToolTip");
			tooltip.setAttribute("style", `display: none; position: absolute; background-color: #707070; border: none; padding: 0; color: white; padding: 4px; border-radius: 2px; font-family: sans-serif; font-size: ${tooltipFontsize};`);
			tooltip.textContent = buttonLabel;
			document.body.appendChild(tooltip);

			let isClicked = false; // a flag to represent whether the button has been clicked
			let timeoutId = null;
			btn.addEventListener("mouseover", function (e) { // mouseover listener
				clearTimeout(timeoutId);
				btn.style.transform = "scale(1.3)"; // increase size of the button
				tooltip.style.display = "block"; // Show the tooltip
				tooltip.style.left = e.pageX - 14 + 'px'; // Position the tooltip
				tooltip.style.top = e.pageY + 17 + 'px';
			});
			btn.addEventListener("mouseout", function () { // mouseout listener
				btn.style.transform = "scale(1)";  // return button to normal size
				timeoutId = setTimeout(function () {
					tooltip.style.display = "none"; // remove tooltip
				}, 100); // delay in milliseconds
			});
			tooltip.addEventListener("mouseover", function () { // mouseover listener for the tooltip
				clearTimeout(timeoutId);
			});
			tooltip.addEventListener("mouseout", function () { // mouseout listener for the tooltip
				timeoutId = setTimeout(function () {
					tooltip.style.display = "none"; // remove tooltip
				}, 100); // delay in milliseconds
			});
			btn.addEventListener("click", function () { // click listener
				isClicked = !isClicked; // toggle the flag
				if (isClicked) {
					btn.style.color = "#0BDA51";
					tooltip.textContent = "Un" + buttonLabel.toLowerCase();
					btn.setAttribute("data-testid", buttonLabel.toLowerCase());
				} else {
					btn.style.color = "gray";
					tooltip.textContent = buttonLabel;
					btn.setAttribute("data-testid", "un" + buttonLabel.toLowerCase());
				}
			});

			metricsNode.prepend(btn);
			tweet.setAttribute('data-buttonadded', 1);
		}
	});

}




// TODO: twitter slots in who to follow in the middle of feed; what to do?
// TODO: check quote tweets - save quote data properly
// TODO: save more tweet meta data
