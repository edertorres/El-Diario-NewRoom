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

use BitAndBlack\Helpers\XMLHelper;
use DOMDocument;
use DOMElement;
use DomNode;
use PHPUnit\Framework\TestCase;

/**
 * Class XMLHelperTest
 *
 * @package BitAndBlack\Helpers\Tests
 */
class XMLHelperTest extends TestCase
{
    private string $xml = '<?xml version="1.0"?>' . PHP_EOL . '<test random="value"/>' . PHP_EOL;

    /**
     * @return void
     */
    public function testHasIsAttribute(): void
    {
        $domDocument = new DOMDocument();
        $domDocument->loadXML($this->xml);

        /** @var DOMElement $element */
        $element = $domDocument->getElementsByTagName('test')->item(0);

        $attributeExisting = XMLHelper::hasIsAttribute($element, 'random', 'value');
        self::assertTrue($attributeExisting);

        $attributeNotExisting = XMLHelper::hasIsAttribute($element, 'notExistingAttribute', 'notExistingValue');
        self::assertFalse($attributeNotExisting);
    }

    /**
     * @return void
     */
    public function testHasGetOr(): void
    {
        $domDocument = new DOMDocument();
        $domDocument->loadXML($this->xml);

        /** @var DOMElement $element1 */
        $element1 = $domDocument->getElementsByTagName('test')->item(0);
        
        $attributeExisting = XMLHelper::hasGetOr(
            $element1,
            'random'
        );
        self::assertSame(
            'value',
            $attributeExisting
        );

        $attributeNotExisting = XMLHelper::hasGetOr(
            $element1,
            'notExistingAttribute',
            'notExistingValue'
        );
        self::assertSame(
            'notExistingValue',
            $attributeNotExisting
        );
        
        $element2 = $domDocument->createElement('Test');
        $element2->setAttribute('testattribute', 'testvalue');
        
        $attributeExisting = XMLHelper::hasGetOr(
            $element2,
            'testattribute'
        );
        self::assertSame(
            'testvalue',
            $attributeExisting
        );
    }

    /**
     * @return void
     */
    public function testCanLoadHTML(): void
    {
        $string = '
            <html lang="en">
                <head>
                    <title>Test</title>
                </head>
                <body>
                    <p>Testüß</p>
                </body>
            </html>
        ';
        
        $domDocument = new DOMDocument();
        $domDocument->preserveWhiteSpace = false;
        $domDocument->formatOutput = true;
        
        XMLHelper::loadHTML($domDocument, $string);

        /** @var DomNode $firstNode */
        $firstNode = $domDocument->childNodes->item(0);
        
        self::assertSame(
            'html',
            $firstNode->nodeName
        );

        $pNodes = $domDocument->getElementsByTagName('p');
        $pNode = $pNodes->item(0);

        if (null === $pNode) {
            self::fail();
        }

        self::assertSame(
            'Testüß',
            $pNode->textContent
        );
    }
}
