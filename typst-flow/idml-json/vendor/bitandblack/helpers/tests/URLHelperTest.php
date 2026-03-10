<?php

/**
 * Bit&Black Helpers - Useful methods for PHP you may like.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Helpers\Tests;

use BitAndBlack\Helpers\URLHelper;
use PHPUnit\Framework\TestCase;

/**
 * Class URLHelperTest
 *
 * @package BitAndBlack\Helpers\Tests\Helpers
 */
class URLHelperTest extends TestCase
{
    /**
     * @return void
     */
    public function testGetScriptURL(): void
    {
        $_SERVER = [
            'HTTP_HOST' => 'localhost',
            'HTTP_CONNECTION' => 'keep-alive',
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.57 Safari/536.11',
            'HTTP_ACCEPT' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'HTTP_REFERER' => 'http://localhost/php/super-variables/$_SERVER.php',
            'HTTP_ACCEPT_ENCODING' => 'gzip,deflate,sdch',
            'HTTP_ACCEPT_LANGUAGE' => 'en-US,en;q=0.8',
            'HTTP_ACCEPT_CHARSET' => 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
            'HTTP_COOKIE' => 'bsau=13422601771944046296; bsas=13422601771975238542',
            'PATH' => 'C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem; C:\Windows\System32\WindowsPowerShell\v1.0\; c:\python32\python;',
            'SystemRoot' => 'C:\Windows',
            'COMSPEC' => 'C:\Windows\system32\cmd.exe',
            'PATHEXT' => '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC',
            'WINDIR' => 'C:\Windows',
            'SERVER_SIGNATURE' => '',
            'SERVER_SOFTWARE' => 'Apache/2.2.11 (Win32) PHP/5.3.0',
            'SERVER_NAME' => 'localhost',
            'SERVER_ADDR' => '127.0.0.1',
            'SERVER_PORT' => '80',
            'REMOTE_ADDR' => '127.0.0.1',
            'DOCUMENT_ROOT' => 'F:/wamp/www/',
            'SERVER_ADMIN' => 'admin@localhost',
            'SCRIPT_FILENAME' => 'F:/wamp/www/php/super-variables/test-$_server.php',
            'REMOTE_PORT' => '51124',
            'GATEWAY_INTERFACE' => 'CGI/1.1',
            'SERVER_PROTOCOL' => 'HTTP/1.1',
            'REQUEST_METHOD' => 'GET',
            'QUERY_STRING' => '',
            'REQUEST_URI' => '/php/super-variables/test-$_server.php',
            'SCRIPT_NAME' => '/php/super-variables/test-$_server.php',
            'PHP_SELF' => '/php/super-variables/test-$_server.php',
            'REQUEST_TIME' => 1_342_260_551,
        ];
        
        self::assertSame(
            '/php/super-variables/test-$_server.php',
            URLHelper::getScriptURL()
        );
    }
}
