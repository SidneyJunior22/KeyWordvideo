const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')

const watsonApiKey = require('../credentials/watson-nlu.json').apiKey
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js')
 
var nlu = new NaturalLanguageUnderstandingV1({
  apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
})



async function robot(content) {
  await fetchContentFromWikipedia(content)
  sanitizedContent(content)
  breakContentIntoSentences(content)
  limitMaximumSentences(content)
  await fetchKeywordlOfAllSentences(content)

  async function fetchContentFromWikipedia(content) {
    const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey)
    const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2')
    const wikipediaResponde = await wikipediaAlgorithm.pipe(content.searchTerm)
    const wikipediaContent = wikipediaResponde.get()

    content.sourceContentOrigin = wikipediaContent.content
  }

  function sanitizedContent(content){
    const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOrigin)
    const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)
    
    content.sourceContentSanitized = withoutDatesInParentheses

    function removeBlankLinesAndMarkdown(text) {
      const allLines = text.split('\n')
      
      const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
        if(line.trim().length === 0 || line.trim().startsWith('=')) {
          return false
        }
        return true
      })
      return withoutBlankLinesAndMarkdown.join(' ')
    }
  }
  function removeDatesInParentheses(text) {
    return text.replace(/\((?:\([^(>]*\)|[^()])*\)/gm, '').replace(/ /g,' ')
  }
  function breakContentIntoSentences(content) {
   content.sentences = []

    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    sentences.forEach((sentence) =>  {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: []
      })
    })
  }

  function limitMaximumSentences(content) {
    content.sentences = content.sentences.slice(0,content.maximumSentences)
  }

  async function fetchKeywordlOfAllSentences(content) {
    for (const sentence of content.sentences) {
      sentence.keywords = await fetchWatsonAndReturnKeuwords(sentence.text)
    }
  }

  async function fetchWatsonAndReturnKeuwords(sentence) {
    return new promise((resolve, reject) => { 
      nlu.analyze({
        text: sentence,
        features: {
          keywords: {}
        }
      }, (error, response) => {
        if (error) {
          throw error
        }
        const keywords = response.keywords.map((keyword) => {
          return keyword.text
        })
        resolve(keywords)
      })
    })
  }
}

module.exports = robot