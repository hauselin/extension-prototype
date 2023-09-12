const debug = true;  // true to print many objects (set to false for production)
let tweetsLoaded = [];  // tweets loaded when DOM changes (mutatation observer)
let tweetsIncoming = {};
let tweetsCurrentView = {};
let tweetsOutgoing = {};
let tweetsOut = {};
let userid;
let username;
generatePID();

let currentUrl = getPageUrl();
let urlChanged = false;
console.error("currentUrl", currentUrl);

// run callback function whenever DOM changes
// https://developer.chrome.com/blog/detect-dom-changes-with-mutation-observers/
const observer = new MutationObserver(function (mutations) {
    let pageType = getPageType();
    if (debug) {
        console.log("DEBUG pagetype: ", pageType);
    }
    if (currentUrl != getPageUrl()) {
        currentUrl = getPageUrl();
        urlChanged = true;
        if (debug) {
            console.error("DEBUG page changed to: ", currentUrl);
        }
    }

    // if articles/tweets loaded in DOM
    if (checkArticleLoadStatus()) {
        // get tweets loaded in DOM
        let tweetsInDOM = getLoadedArticles(debug);

        // modify each tweet
        tweetsInDOM.forEach((tweet) => {

            if (debug) {
                let tweetObj = createTweetObj(tweet);
                console.log("tweetObj", tweetObj);
            }

            // add engagement listener for article/tweet
            if (!tweet.getAttribute("data-articleclicklisten")) {
                addArticleListener(tweet);
            }

            // add button
            addButton("Trust");

            // add engagement listeners for all buttons (including the new button added above)
            addEngagementListeners();

            // post requests when landing on a single tweet page
            if (pageType == "singletweet" && urlChanged) {
                const clickTime = new Date().toISOString();
                const userid = getUseridFromCookie();
                const tweetIdUrl = getTweetIdUrl(tweet);
                const tweetId = tweetIdUrl["tweetid"];

                // TODO: might have to change this depending on when the tweet info is fully loaded in DOM
                if (getTweetMetrics(tweet) != "") {
                    urlChanged = false;
                    postArticleEngage("pid", userid, clickTime, tweetId);
                    let tweetObj = createTweetObj(tweet);
                    postTweetRead("pid", userid, clickTime, tweetId);
                    console.error("tweetObj", tweetObj);
                }
            }

            // add listeners to retweet dropdown menu
            let dropdown = getRetweetDropdownMenu();
            if (dropdown) {
                addRetweetDropdownListener(dropdown, retweetId);
            }

        });

        // determine exposure by simulating scroll when DOM mutates
        handleScroll();
    }

});

observer.observe(document.body, { childList: true, subtree: true });





const handleScroll = () => {

    // new tweets coming into view
    tweetsIncoming = getFullyVisibleTweets();
    // existing tweets going out of view
    tweetsOutgoing = objDifference(tweetsCurrentView, tweetsIncoming);

    // coming into view
    if (debug) {
        // console.error(`${objLength(tweetsIncoming)} tweets fully in view`, tweetsIncoming);
    }
    let newTweets = objDifference(tweetsIncoming, tweetsCurrentView);
    if (objLength(newTweets) > 0) {
        // console.error(`${objLength(newTweets)} newly-in-view tweets`);
        postTweetsExpose(pid, getUseridFromCookie(), new Date().toISOString(), newTweets);
        tweetsCurrentView = tweetsIncoming;
    }

    // going out of view
    let diffTweets = objDifference(tweetsOutgoing, tweetsOut);
    if (objLength(diffTweets) > 0) {
        // console.error(`${objLength(tweetsOutgoing)} out-of-view tweets`, tweetsOutgoing);
        // compute dwell time for each tweet and post to server: tweetsOutgoing
        postDwell(pid, getUseridFromCookie(), new Date().toISOString(), computeDwell(tweetsOutgoing));
        tweetsOut = tweetsOutgoing;
    }

}

const throttle = (func, limit) => {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
const throttledHandleScroll = throttle(handleScroll, 200);
window.addEventListener('scroll', throttledHandleScroll);

