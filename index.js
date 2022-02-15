'use strict'

/**
 * 
 * Tips:
 * 
 * 涉及概念：
 *  new RegExp：对象创建正则表达式
 *  ^ 匹配字符串的开始，$	匹配字符串的结束，忽略换行符
 *  []原子表，只匹配其中的一个原子，[^]	只匹配"除了"其中字符的任意一个原子
 *  ()原子组，与[]差别在于原子组一次匹配多个原子
 *  ?	重复零次或一次，+	重复一次或更多次
 *  禁止贪婪：+?	重复1次或更多次，但尽可能少重复
 *  (?:x)	匹配 'x' 但是不记住匹配项。这种括号叫作非捕获括号，使得你能够定义与正则表达式运算符一起使用的子表达式。
 *  
 * 
 *  '^(?:@([^/]+?)[/])?([^/]+?)$'
 *  
 *   eg: '@somescope/somepackagename'.match(new RegExp('^(?:@([^/]+?)[/])?([^/]+?)$'))
 *   匹配结果:[['@somescope/somepackagename', 'somescope', 'somepackagename',...]
 * 
 *  包含两个原子组：
 *     1 ^(?:@([^/]+?)[/])?：0或1次在头部出现此原子组
 *      eg:'@somescope/somepackagename'.match(new RegExp('^(?:@([^/]+?)[/])?')) 
 *      匹配结果:['@somescope/', 'somescope',...]
 *      1: "somescope"   得到所需域名
 *                       
 *     2 ([^/]+?)$：以该原子组结尾
 *      eg:'@somescope/somepackagename'.match(new RegExp('([^/]+?)$'))
 *      匹配结果:['somepackagename', 'somepackagename',...]
 *      1: "somescope"   得到所需包名
 * 

 */
var scopedPackagePattern = new RegExp('^(?:@([^/]+?)[/])?([^/]+?)$')
// 这个包是包括node内置 module的列表
var builtins = require('builtins')
// 保留名(黑名单)
var blacklist = ['node_modules', 'favicon.ico']

var validate = (module.exports = function (name) {
  // 警告：用于表示过去package name允许、如今不允许的兼容error
  var warnings = []
  // 存储不符号合格的包名的规则
  var errors = []

  // 校验格式
  if (name === null) {
    errors.push('name cannot be null')
    return done(warnings, errors)
  }

  if (name === undefined) {
    errors.push('name cannot be undefined')
    return done(warnings, errors)
  }

  if (typeof name !== 'string') {
    errors.push('name must be a string')
    return done(warnings, errors)
  }

  // 校验包名长度必须大于0
  if (!name.length) {
    errors.push('name length must be greater than zero')
  }

  // 校验包名不能以.开头，
  // Tips: `.`：匹配除换行符外的任意字符, 为匹配`.`字符，使用`\`进行转义
  if (name.match(/^\./)) {
    errors.push('name cannot start with a period')
  }

  // 校验包名不能以_开头
  if (name.match(/^_/)) {
    errors.push('name cannot start with an underscore')
  }

  // 校验包名不能包含任何的前导、后导空格
  if (name.trim() !== name) {
    errors.push('name cannot contain leading or trailing spaces')
  }

  // No funny business
  // 校验包名不能为保留字，即不能有上面的黑名单内容
  blacklist.forEach(function (blacklistedName) {
    if (name.toLowerCase() === blacklistedName) {
      errors.push(blacklistedName + ' is a blacklisted name')
    }
  })

  // Generate warnings for stuff that used to be allowed
  // 为过去允许的内容生成警告

  // core module names like http, events, util, etc
  // 核心模块名称，如http、events、util等

  // 校验包名是否是node 内置module名、给予警告
  builtins.forEach(function (builtin) {
    if (name.toLowerCase() === builtin) {
      warnings.push(builtin + ' is a core module name')
    }
  })

  // really-long-package-names-------------------------------such--length-----many---wow
  // the thisisareallyreallylongpackagenameitshouldpublishdowenowhavealimittothelengthofpackagenames-poch.
  // 校验包名最大长度
  if (name.length > 214) {
    warnings.push('name can no longer contain more than 214 characters')
  }

  // mIxeD CaSe nAMEs
  // 包名必须小写
  if (name.toLowerCase() !== name) {
    warnings.push('name can no longer contain capital letters')
  }

  /**
   * 校验包名不能包含特殊字段 ~'!()*
   * 详解：
   *   name.split('/').slice(-1)[0] => 获取包名
   *   name.split('/') 处理 npm package scope（包有作用域）场景，如@somescope/somepackagename
   *   slice(-1)[0] 保证永远截取包名正确，slice(-1)可以取得最后一个数组，[0]取出内容
   * eg:
   *   '@somescope/somepackagename'.split('/') =>  ['@somescope', 'somepackagename']
   *   '@somescope/somepackagename'.split('/').slice(-1)[0] => 'somepackagename'
   *
   * Tips:
   *  RegExp 正则方法：match,matchAll,split,replace,search
   *  String 字符串方法：test,exec
   */

  if (/[~'!()*]/.test(name.split('/').slice(-1)[0])) {
    warnings.push('name can no longer contain special characters ("~\'!()*")')
  }

  // 包名不能包含non-url-safe字符
  // 关于encodeURIComponent不转义字符:A-Z a-z 0-9 - _ . ! ~ * ' ( )
  /**
   * Tips:
   *  区别对比                        encodeURIComponent() vs encodeURI()
   *  "-_.!~*'()";  // 不转义字符         不转义              不转义
   * ";,/?:@&=+$";  // 保留字符           转义                不转义
   * "#";           // 数字标志           转义                不转义
   * "ABC abc 123"; // 字母数字字符和空格  转义                转义
   *
   */
  if (encodeURIComponent(name) !== name) {
    // Maybe it's a scoped package name, like @user/package
    // 也许它是一个限定了范围的包名，比如@user/package  
    // 具体规则分析在scopedPackagePattern变量定义处，eg nameMatch = '@somescope/somepackagename'
    var nameMatch = name.match(scopedPackagePattern)
    if (nameMatch) {
      var user = nameMatch[1] // 获得限定范围的域名 somescope
      var pkg = nameMatch[2]  // 获得包名 somepackagename
      if (
        encodeURIComponent(user) === user &&
        encodeURIComponent(pkg) === pkg
      ) {
        return done(warnings, errors)
      }
    }

    errors.push('name can only contain URL-friendly characters')
  }

  return done(warnings, errors)
})

validate.scopedPackagePattern = scopedPackagePattern

// 返回结果的util方法
var done = function (warnings, errors) {
  var result = {
    // 我们一般用该属性来判断一个包名是否合法
    validForNewPackages: errors.length === 0 && warnings.length === 0,
    // 这个属性是用于兼容最开始node package name带来的遗留问题，那个时候有些包名不规范
    validForOldPackages: errors.length === 0,
    warnings: warnings,
    errors: errors,
  }
  if (!result.warnings.length) delete result.warnings
  if (!result.errors.length) delete result.errors
  return result
}
