<?php

/**
 * Bit&Black Composer Helper.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Composer;

use BitAndBlack\Composer\Exception\VendorNotFoundException;

/**
 * The VendorPath class finds and returns the path to the `vendor` folder.
 *
 * @package BitAndBlack\Composer
 */
class VendorPath
{
    private ?string $classLoaderPath = null;
    
    private bool $checkForExistence = true;

    /**
     * @return string
     * @throws VendorNotFoundException
     */
    public function __toString(): string
    {
        return $this->getVendorPath();
    }

    /**
     * Returns the path to the `vendor` folder.
     *
     * @return string
     * @throws VendorNotFoundException
     */
    public function getVendorPath(): string
    {
        if (false !== self::runsInWordPress()
            && null !== $wordPressVendorPath = self::getNearestFile('vendor' . DIRECTORY_SEPARATOR . 'autoload.php')
        ) {
            return dirname($wordPressVendorPath);
        }

        if (null === $classLoaderPath = $this->getClassLoaderPath()) {
            $classLoaderPath = (string) new ClassLoaderPath();
        }

        $vendorPath = dirname($classLoaderPath, 2);

        if (true === $this->checkForExistence && !is_dir($vendorPath)) {
            throw new VendorNotFoundException();
        }

        return $vendorPath;
    }

    /**
     * Returns if this script runs inside WordPress.
     *
     * @return bool
     */
    private static function runsInWordPress(): bool
    {
        return defined('ABSPATH');
    }
    
    /**
     * Returns the nearest file by searching always one level higher.
     * This is needed for example in WordPress, where multiple autoload.php files exist.
     *
     * @param string $fileName The files name.
     * @return string|null
     */
    private static function getNearestFile(string $fileName): ?string
    {
        $rootFile = __FILE__;
        $level = 1;
        $match = null;
        $dir = null;

        while (null === $match && DIRECTORY_SEPARATOR !== $dir) {
            $dir = dirname($rootFile, $level);
            $files = glob($dir . DIRECTORY_SEPARATOR . $fileName);

            if (!empty($files)) {
                $match = $files[0];
            }

            ++$level;
        }

        return $match;
    }

    /**
     * Returns the path to Composer's `ClassLoader.php` if a custom one has been set.
     *
     * @return string|null
     */
    public function getClassLoaderPath(): ?string
    {
        return $this->classLoaderPath;
    }

    /**
     * Sets a custom path to Composer's `ClassLoader.php`.
     *
     * @param string $classLoaderPath
     * @return $this
     */
    public function setClassLoaderPath(string $classLoaderPath): self
    {
        $this->classLoaderPath = $classLoaderPath;
        return $this;
    }

    /**
     * Enables the check for the vendor folder existing.
     *
     * @return $this
     */
    public function enableCheckForExistence(): self
    {
        $this->checkForExistence = true;
        return $this;
    }

    /**
     * Disables the check for the vendor folder existing.
     *
     * @return $this
     */
    public function disableCheckForExistence(): self
    {
        $this->checkForExistence = false;
        return $this;
    }
}
